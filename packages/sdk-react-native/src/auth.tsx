/**
 * DataClaus Authentication Module
 *
 * Provides authentication for mobile apps using DataClaus's OTP-based system.
 * Users authenticate once with DataClaus and can use the same account across
 * all apps integrated with DataClaus.
 *
 * Flow:
 * 1. User enters phone number
 * 2. SDK calls DataClaus API to request OTP
 * 3. User receives OTP via SMS
 * 4. SDK verifies OTP with DataClaus API
 * 5. SDK stores tokens securely
 * 6. SDK provides authenticated state to the app
 */

import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

// AsyncStorage is a peer dependency - will be resolved at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AsyncStorage: any;
try {
  // Dynamic import to avoid hard dependency
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  // Fallback for web/testing environments
  AsyncStorage = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
}

// ========================
// Types
// ========================

export interface DataClausAuthConfig {
  /** DataClaus API URL (usually your backend that proxies to DataClaus) */
  apiUrl: string;
  /** Storage key prefix for tokens */
  storagePrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface DataClausUser {
  id: string;
  phone: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  qualityScore: number;
  walletId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: DataClausUser | null;
  tokens: AuthTokens | null;
}

export interface RequestOTPResult {
  success: boolean;
  expiresIn: number;
  message: string;
}

export interface VerifyOTPResult {
  success: boolean;
  user: DataClausUser;
  tokens: AuthTokens;
  isNewUser: boolean;
}

export interface AuthUserEarnings {
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  qualityScore: number;
}

// ========================
// Storage Keys
// ========================

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'dataclaus_access_token',
  REFRESH_TOKEN: 'dataclaus_refresh_token',
  EXPIRES_AT: 'dataclaus_expires_at',
  USER: 'dataclaus_user',
};

// ========================
// DataClausAuth Class
// ========================

export class DataClausAuth {
  private config: DataClausAuthConfig;
  private tokens: AuthTokens | null = null;
  private user: DataClausUser | null = null;
  private onAuthStateChange?: (state: AuthState) => void;

  constructor(config: DataClausAuthConfig) {
    this.config = {
      storagePrefix: 'dataclaus_',
      debug: false,
      ...config,
    };
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[DataClausAuth]', ...args);
    }
  }

  private getStorageKey(key: string): string {
    return `${this.config.storagePrefix}${key}`;
  }

  /**
   * Initialize auth state from storage
   */
  async initialize(): Promise<AuthState> {
    this.log('Initializing auth...');

    try {
      const [accessToken, refreshToken, expiresAtStr, userStr] = await Promise.all([
        AsyncStorage.getItem(this.getStorageKey(STORAGE_KEYS.ACCESS_TOKEN)),
        AsyncStorage.getItem(this.getStorageKey(STORAGE_KEYS.REFRESH_TOKEN)),
        AsyncStorage.getItem(this.getStorageKey(STORAGE_KEYS.EXPIRES_AT)),
        AsyncStorage.getItem(this.getStorageKey(STORAGE_KEYS.USER)),
      ]);

      if (accessToken && refreshToken && expiresAtStr && userStr) {
        const expiresAt = parseInt(expiresAtStr, 10);
        const user = JSON.parse(userStr) as DataClausUser;

        this.tokens = { accessToken, refreshToken, expiresAt };
        this.user = user;

        // Check if token is expired
        if (Date.now() > expiresAt) {
          this.log('Token expired, attempting refresh...');
          try {
            await this.refreshTokens();
          } catch (error) {
            this.log('Token refresh failed, clearing auth');
            await this.clearAuth();
            return this.getAuthState();
          }
        }

        this.log('Auth initialized successfully');
      }
    } catch (error) {
      this.log('Failed to initialize auth:', error);
    }

    return this.getAuthState();
  }

  /**
   * Request OTP for phone number
   */
  async requestOTP(phone: string, recaptchaToken?: string): Promise<RequestOTPResult> {
    this.log('Requesting OTP for', phone);

    const response = await fetch(`${this.config.apiUrl}/auth/user/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        recaptcha_token: recaptchaToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to request OTP');
    }

    return {
      success: true,
      expiresIn: data.expires_in,
      message: data.message,
    };
  }

  /**
   * Verify OTP and authenticate
   */
  async verifyOTP(phone: string, code: string): Promise<VerifyOTPResult> {
    this.log('Verifying OTP for', phone);

    const response = await fetch(`${this.config.apiUrl}/auth/user/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to verify OTP');
    }

    // Store tokens and user
    const tokens: AuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    const user: DataClausUser = {
      id: data.user.id,
      phone: data.user.phone,
      email: data.user.email,
      displayName: data.user.display_name,
      avatarUrl: data.user.avatar_url,
      qualityScore: data.user.quality_score,
      walletId: data.user.wallet_id,
    };

    await this.storeAuth(tokens, user);

    this.notifyAuthStateChange();

    return {
      success: true,
      user,
      tokens,
      isNewUser: data.is_new_user,
    };
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    this.log('Refreshing tokens...');

    const response = await fetch(`${this.config.apiUrl}/auth/user/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: this.tokens.refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to refresh token');
    }

    const tokens: AuthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    const user: DataClausUser = {
      id: data.user.id,
      phone: data.user.phone,
      email: data.user.email,
      displayName: data.user.display_name,
      avatarUrl: data.user.avatar_url,
      qualityScore: data.user.quality_score,
      walletId: data.user.wallet_id,
    };

    await this.storeAuth(tokens, user);

    this.log('Tokens refreshed successfully');
    this.notifyAuthStateChange();
  }

  /**
   * Logout and clear stored auth
   */
  async logout(): Promise<void> {
    this.log('Logging out...');

    try {
      if (this.tokens?.accessToken) {
        await fetch(`${this.config.apiUrl}/auth/user/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.tokens.accessToken}`,
          },
        });
      }
    } catch (error) {
      this.log('Logout API call failed:', error);
    }

    await this.clearAuth();
    this.notifyAuthStateChange();
  }

  /**
   * Get current user profile from API
   */
  async getProfile(): Promise<DataClausUser | null> {
    if (!this.tokens?.accessToken) {
      return null;
    }

    const response = await fetch(`${this.config.apiUrl}/auth/user/me`, {
      headers: {
        'Authorization': `Bearer ${this.tokens.accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        try {
          await this.refreshTokens();
          return this.getProfile();
        } catch {
          await this.clearAuth();
          return null;
        }
      }
      throw new Error('Failed to get profile');
    }

    const data = await response.json();

    this.user = {
      id: data.id,
      phone: data.phone,
      email: data.email,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      qualityScore: data.quality_score,
      walletId: data.wallet_id || '',
    };

    await AsyncStorage.setItem(
      this.getStorageKey(STORAGE_KEYS.USER),
      JSON.stringify(this.user)
    );

    return this.user;
  }

  /**
   * Get user earnings
   */
  async getEarnings(): Promise<AuthUserEarnings | null> {
    if (!this.tokens?.accessToken || !this.user?.id) {
      return null;
    }

    const response = await fetch(`${this.config.apiUrl}/users/${this.user.id}/earnings`, {
      headers: {
        'Authorization': `Bearer ${this.tokens.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get earnings');
    }

    const data = await response.json();

    return {
      totalEarned: data.total_earned,
      pendingBalance: data.pending_balance,
      availableBalance: data.available_balance,
      qualityScore: data.quality_score,
    };
  }

  /**
   * Get access token for API calls
   */
  getAccessToken(): string | null {
    return this.tokens?.accessToken || null;
  }

  /**
   * Get current user
   */
  getUser(): DataClausUser | null {
    return this.user;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.tokens?.accessToken && Date.now() < (this.tokens?.expiresAt || 0);
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return {
      isAuthenticated: this.isAuthenticated(),
      isLoading: false,
      user: this.user,
      tokens: this.tokens,
    };
  }

  /**
   * Subscribe to auth state changes
   */
  onStateChange(callback: (state: AuthState) => void): () => void {
    this.onAuthStateChange = callback;
    return () => {
      this.onAuthStateChange = undefined;
    };
  }

  private async storeAuth(tokens: AuthTokens, user: DataClausUser): Promise<void> {
    this.tokens = tokens;
    this.user = user;

    await Promise.all([
      AsyncStorage.setItem(this.getStorageKey(STORAGE_KEYS.ACCESS_TOKEN), tokens.accessToken),
      AsyncStorage.setItem(this.getStorageKey(STORAGE_KEYS.REFRESH_TOKEN), tokens.refreshToken),
      AsyncStorage.setItem(this.getStorageKey(STORAGE_KEYS.EXPIRES_AT), tokens.expiresAt.toString()),
      AsyncStorage.setItem(this.getStorageKey(STORAGE_KEYS.USER), JSON.stringify(user)),
    ]);
  }

  private async clearAuth(): Promise<void> {
    this.tokens = null;
    this.user = null;

    await Promise.all([
      AsyncStorage.removeItem(this.getStorageKey(STORAGE_KEYS.ACCESS_TOKEN)),
      AsyncStorage.removeItem(this.getStorageKey(STORAGE_KEYS.REFRESH_TOKEN)),
      AsyncStorage.removeItem(this.getStorageKey(STORAGE_KEYS.EXPIRES_AT)),
      AsyncStorage.removeItem(this.getStorageKey(STORAGE_KEYS.USER)),
    ]);
  }

  private notifyAuthStateChange(): void {
    if (this.onAuthStateChange) {
      this.onAuthStateChange(this.getAuthState());
    }
  }
}

// ========================
// React Context & Hook
// ========================

interface DataClausAuthContextValue extends AuthState {
  auth: DataClausAuth;
  requestOTP: (phone: string, recaptchaToken?: string) => Promise<RequestOTPResult>;
  verifyOTP: (phone: string, code: string) => Promise<VerifyOTPResult>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<DataClausUser | null>;
  getEarnings: () => Promise<AuthUserEarnings | null>;
}

const DataClausAuthContext = createContext<DataClausAuthContextValue | null>(null);

interface DataClausAuthProviderProps {
  config: DataClausAuthConfig;
  children: ReactNode;
}

export function DataClausAuthProvider({ config, children }: DataClausAuthProviderProps) {
  const [auth] = useState(() => new DataClausAuth(config));
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    tokens: null,
  });

  useEffect(() => {
    // Initialize auth on mount
    auth.initialize().then((initialState) => {
      setState({ ...initialState, isLoading: false });
    });

    // Subscribe to auth state changes
    const unsubscribe = auth.onStateChange((newState) => {
      setState({ ...newState, isLoading: false });
    });

    return unsubscribe;
  }, [auth]);

  const requestOTP = useCallback(
    (phone: string, recaptchaToken?: string) => auth.requestOTP(phone, recaptchaToken),
    [auth]
  );

  const verifyOTP = useCallback(
    (phone: string, code: string) => auth.verifyOTP(phone, code),
    [auth]
  );

  const logout = useCallback(() => auth.logout(), [auth]);

  const refreshProfile = useCallback(() => auth.getProfile(), [auth]);

  const getEarnings = useCallback(() => auth.getEarnings(), [auth]);

  const value: DataClausAuthContextValue = {
    ...state,
    auth,
    requestOTP,
    verifyOTP,
    logout,
    refreshProfile,
    getEarnings,
  };

  return (
    <DataClausAuthContext.Provider value={value}>
      {children}
    </DataClausAuthContext.Provider>
  );
}

/**
 * Hook to access DataClaus auth state and methods
 */
export function useDataClausAuth(): DataClausAuthContextValue {
  const context = useContext(DataClausAuthContext);

  if (!context) {
    throw new Error('useDataClausAuth must be used within a DataClausAuthProvider');
  }

  return context;
}

export default DataClausAuth;
