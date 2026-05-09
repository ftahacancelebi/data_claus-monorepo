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
 * Hash fingerprint to a stable string for cross-app user matching.
 *
 * Returns a SHA-256 hex digest. Three implementation tiers, picked at runtime
 * by best-available capability:
 *   1. expo-crypto (if present in the host app)
 *   2. globalThis.crypto.subtle (Web Crypto on supporting RN runtimes)
 *   3. Pure-JS SHA-256 fallback (always works)
 *
 * The hash is sent over the wire — the simple bit-shift hash that lived here
 * before was non-cryptographic and trivially collidable, which let an
 * attacker forge fingerprints from a few known device shapes.
 */
export async function hashFingerprint(
  fingerprint: DeviceFingerprint,
): Promise<string> {
  const data = canonicalFingerprintString(fingerprint);
  return sha256Hex(data);
}

function canonicalFingerprintString(fp: DeviceFingerprint): string {
  return [
    fp.platform,
    fp.osVersion,
    fp.screenWidth,
    fp.screenHeight,
    fp.timezone,
    fp.locale,
    fp.deviceId || 'unknown',
  ].join('|');
}

interface MinimalSubtle {
  digest: (algorithm: string, data: Uint8Array) => Promise<ArrayBuffer>;
}

interface MinimalTextEncoder {
  encode: (input: string) => Uint8Array;
}

async function sha256Hex(input: string): Promise<string> {
  // Tier 1: expo-crypto
  try {
    const expoCrypto = require('expo-crypto') as
      | {
          digestStringAsync?: (
            algorithm: string,
            data: string,
            options?: { encoding?: string },
          ) => Promise<string>;
          CryptoDigestAlgorithm?: { SHA256: string };
          CryptoEncoding?: { HEX: string };
        }
      | undefined;
    if (expoCrypto?.digestStringAsync && expoCrypto.CryptoDigestAlgorithm) {
      return await expoCrypto.digestStringAsync(
        expoCrypto.CryptoDigestAlgorithm.SHA256,
        input,
        { encoding: expoCrypto.CryptoEncoding?.HEX || 'hex' },
      );
    }
  } catch {
    // expo-crypto not installed
  }

  // Tier 2: Web Crypto (if available in this RN runtime)
  const g = globalThis as {
    crypto?: { subtle?: MinimalSubtle };
    TextEncoder?: new () => MinimalTextEncoder;
  };
  const subtle = g.crypto?.subtle;
  if (subtle?.digest && g.TextEncoder) {
    const bytes = new g.TextEncoder().encode(input);
    const hashBuffer = await subtle.digest('SHA-256', bytes);
    return bufferToHex(new Uint8Array(hashBuffer));
  }

  // Tier 3: Pure-JS fallback
  return sha256Pure(input);
}

function bufferToHex(buf: Uint8Array): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    out += buf[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * RFC 6234 SHA-256 in pure JS. ~80 lines, no deps. Used only when neither
 * expo-crypto nor Web Crypto is available. Not constant-time, but fingerprint
 * hashing has no timing-attack threat model.
 */
function sha256Pure(message: string): string {
  const utf8 = utf8Bytes(message);
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLen = utf8.length * 8;
  const padded = new Uint8Array(((utf8.length + 9 + 63) >> 6) << 6);
  padded.set(utf8);
  padded[utf8.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  const W = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(i + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 =
        rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 =
        rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  let out = '';
  for (let i = 0; i < 8; i++) out += H[i].toString(16).padStart(8, '0');
  return out;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function utf8Bytes(str: string): Uint8Array {
  const g = globalThis as { TextEncoder?: new () => MinimalTextEncoder };
  if (g.TextEncoder) return new g.TextEncoder().encode(str);
  // Manual UTF-8 encoder for environments lacking TextEncoder.
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let codePoint = str.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < str.length) {
      const low = str.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    if (codePoint < 0x80) {
      out.push(codePoint);
    } else if (codePoint < 0x800) {
      out.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      out.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      out.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(out);
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
      device_fingerprint: await hashFingerprint(this.fingerprint),
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
