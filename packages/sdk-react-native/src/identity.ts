/**
 * DataClaus User Identity Module
 *
 * Links external user identities from developer apps to DataClaus internal users.
 * This enables proper revenue attribution and payout tracking across apps.
 *
 * Flow:
 * 1. Developer calls linkUser() with their user ID
 * 2. DataClaus creates/finds internal user based on external ID + device fingerprint
 * 3. Returns a short-lived user token for authenticated requests
 * 4. All subsequent data sent with this token credits the correct user
 */

import { Platform, Dimensions } from 'react-native';
import { useCallback, useState, useRef, useEffect } from 'react';

// ============================================================
// Types
// ============================================================

export interface UserIdentityConfig {
  /** DataClaus API URL or developer's backend URL */
  apiUrl: string;
  /** Application ID (from DataClaus dashboard) */
  applicationId: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface LinkUserRequest {
  /** Developer's internal user ID */
  externalUserId: string;
  /** Optional email for cross-app matching */
  email?: string;
  /** Optional phone for cross-app matching */
  phone?: string;
}

export interface LinkedUser {
  /** DataClaus internal user ID */
  dataclausUserId: string;
  /** Short-lived token for API requests (valid 24h) */
  userToken: string;
  /** Whether this is a newly created user */
  isNewUser: boolean;
  /** User's wallet ID for earnings */
  walletId: string;
  /** When the token expires */
  tokenExpiresAt: string;
}

export interface UserEarnings {
  /** Total amount earned across all apps */
  totalEarned: number;
  /** Pending balance (below threshold) */
  pendingBalance: number;
  /** Available for withdrawal */
  availableBalance: number;
  /** User's quality score (0-1) */
  qualityScore: number;
  /** Currency code */
  currency: string;
}

export interface DeviceFingerprint {
  platform: 'ios' | 'android' | 'web';
  osVersion: string;
  screenWidth: number;
  screenHeight: number;
  timezone: string;
  locale: string;
  userAgent?: string;
  /** Unique device identifier (IDFV on iOS, Android ID on Android) */
  deviceId?: string;
}

// ============================================================
// Device Fingerprinting
// ============================================================

/**
 * Generate a device fingerprint for user matching.
 * This helps identify the same user across different apps.
 */
export async function generateDeviceFingerprint(): Promise<DeviceFingerprint> {
  const { width, height } = Dimensions.get('window');
  
  const fingerprint: DeviceFingerprint = {
    platform: Platform.OS as 'ios' | 'android' | 'web',
    osVersion: String(Platform.Version || 'unknown'),
    screenWidth: width,
    screenHeight: height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    locale: Platform.select({
      ios: 'en-US', // Would use NativeModules.SettingsManager in real app
      android: 'en-US', // Would use NativeModules.I18nManager in real app
      default: 'en-US',
    }),
  };

  // Try to get device-specific info if react-native-device-info is available
  try {
    // Dynamic import to avoid hard dependency
    const DeviceInfo = require('react-native-device-info');
    if (DeviceInfo) {
      fingerprint.deviceId = await DeviceInfo.getUniqueId();
      fingerprint.userAgent = await DeviceInfo.getUserAgent();
    }
  } catch {
    // react-native-device-info not installed, that's okay
    fingerprint.deviceId = undefined;
  }

  return fingerprint;
}

/**
 * Hash fingerprint to a stable string for matching.
 */
export function hashFingerprint(fingerprint: DeviceFingerprint): string {
  const data = [
    fingerprint.platform,
    fingerprint.osVersion,
    fingerprint.screenWidth,
    fingerprint.screenHeight,
    fingerprint.timezone,
    fingerprint.deviceId || 'unknown',
  ].join('|');

  // Simple hash for fingerprint (in production, use a proper hash)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================
// Identity Manager Class
// ============================================================

export class UserIdentityManager {
  private config: Required<UserIdentityConfig>;
  private linkedUser: LinkedUser | null = null;
  private fingerprint: DeviceFingerprint | null = null;

  constructor(config: UserIdentityConfig) {
    this.config = {
      ...config,
      debug: config.debug ?? false,
    };
  }

  private log(message: string, ...args: unknown[]) {
    if (this.config.debug) {
      console.log(`[DataClaus Identity] ${message}`, ...args);
    }
  }

  /**
   * Link an external user to DataClaus.
   * Call this after user authentication in your app.
   */
  async linkUser(request: LinkUserRequest): Promise<LinkedUser> {
    this.log('Linking user:', request.externalUserId);

    // Generate device fingerprint
    if (!this.fingerprint) {
      this.fingerprint = await generateDeviceFingerprint();
    }

    const payload = {
      external_user_id: request.externalUserId,
      email: request.email,
      phone: request.phone,
      device_fingerprint: hashFingerprint(this.fingerprint),
    };

    try {
      const response = await fetch(
        `${this.config.apiUrl}/applications/${this.config.applicationId}/users/link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Link failed' }));
        throw new Error(error.error || 'Failed to link user');
      }

      const data = await response.json();
      
      this.linkedUser = {
        dataclausUserId: data.dataclaus_user_id,
        userToken: data.user_token,
        isNewUser: data.is_new_user,
        walletId: data.wallet_id,
        tokenExpiresAt: data.token_expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      this.log('User linked successfully:', this.linkedUser.dataclausUserId);
      return this.linkedUser;
    } catch (error) {
      this.log('Failed to link user:', error);
      throw error;
    }
  }

  /**
   * Get the current linked user.
   */
  getLinkedUser(): LinkedUser | null {
    return this.linkedUser;
  }

  /**
   * Get the user token for API requests.
   */
  getUserToken(): string | null {
    if (!this.linkedUser) return null;
    
    // Check if token is expired
    const expiresAt = new Date(this.linkedUser.tokenExpiresAt);
    if (expiresAt < new Date()) {
      this.log('User token expired');
      return null;
    }

    return this.linkedUser.userToken;
  }

  /**
   * Check if a user is currently linked.
   */
  isLinked(): boolean {
    return this.getUserToken() !== null;
  }

  /**
   * Get user's earnings summary.
   */
  async getEarnings(): Promise<UserEarnings | null> {
    const token = this.getUserToken();
    if (!token || !this.linkedUser) {
      this.log('Cannot get earnings: user not linked');
      return null;
    }

    try {
      const response = await fetch(
        `${this.config.apiUrl}/users/${this.linkedUser.dataclausUserId}/earnings`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch earnings');
      }

      const data = await response.json();
      return {
        totalEarned: data.total_earned || 0,
        pendingBalance: data.pending_balance || 0,
        availableBalance: data.available_balance || 0,
        qualityScore: data.quality_score || 0,
        currency: data.currency || 'USD',
      };
    } catch (error) {
      this.log('Failed to get earnings:', error);
      return null;
    }
  }

  /**
   * Clear the linked user session.
   */
  logout(): void {
    this.linkedUser = null;
    this.log('User logged out');
  }
}

// ============================================================
// React Hook
// ============================================================

export interface UseIdentityResult {
  /** Current linked user info */
  linkedUser: LinkedUser | null;
  /** Link a new user */
  linkUser: (request: LinkUserRequest) => Promise<LinkedUser>;
  /** User's earnings */
  earnings: UserEarnings | null;
  /** Refresh earnings */
  refreshEarnings: () => Promise<void>;
  /** Whether currently loading */
  isLoading: boolean;
  /** Whether user is linked */
  isLinked: boolean;
  /** Logout and clear session */
  logout: () => void;
  /** Error message if any */
  error: string | null;
}

/**
 * React hook for user identity management.
 *
 * Usage:
 * ```tsx
 * const { linkUser, linkedUser, earnings, isLinked } = useIdentity({
 *   apiUrl: 'https://api.dataclaus.io',
 *   applicationId: 'your-app-id',
 * });
 *
 * // After user logs in to your app:
 * await linkUser({ externalUserId: user.id, email: user.email });
 *
 * // Show earnings:
 * if (isLinked) {
 *   console.log(`Earned: $${earnings?.totalEarned}`);
 * }
 * ```
 */
export function useIdentity(config: UserIdentityConfig): UseIdentityResult {
  const managerRef = useRef<UserIdentityManager | null>(null);
  const [linkedUser, setLinkedUser] = useState<LinkedUser | null>(null);
  const [earnings, setEarnings] = useState<UserEarnings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    managerRef.current = new UserIdentityManager(config);
  }, [config.apiUrl, config.applicationId]);

  const linkUser = useCallback(async (request: LinkUserRequest): Promise<LinkedUser> => {
    if (!managerRef.current) {
      throw new Error('Identity manager not initialized');
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = await managerRef.current.linkUser(request);
      setLinkedUser(user);

      // Auto-fetch earnings after linking
      const userEarnings = await managerRef.current.getEarnings();
      setEarnings(userEarnings);

      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to link user';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshEarnings = useCallback(async () => {
    if (!managerRef.current || !linkedUser) return;

    setIsLoading(true);
    try {
      const userEarnings = await managerRef.current.getEarnings();
      setEarnings(userEarnings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch earnings';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [linkedUser]);

  const logout = useCallback(() => {
    managerRef.current?.logout();
    setLinkedUser(null);
    setEarnings(null);
    setError(null);
  }, []);

  return {
    linkedUser,
    linkUser,
    earnings,
    refreshEarnings,
    isLoading,
    isLinked: linkedUser !== null,
    logout,
    error,
  };
}

export default UserIdentityManager;
