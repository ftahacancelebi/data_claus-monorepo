/**
 * DataClaus Node.js SDK - Authentication Module
 *
 * Provides server-side authentication verification and user management
 * for backends using DataClaus authentication.
 *
 * Usage:
 * ```typescript
 * const auth = new DataClausAuth({
 *   apiKey: 'your_api_key',
 *   apiUrl: 'http://localhost:3002',
 * });
 *
 * // Verify a user's access token
 * const user = await auth.verifyToken(accessToken);
 *
 * // Get user earnings
 * const earnings = await auth.getUserEarnings(userId);
 * ```
 */

import fetch from 'node-fetch';

export interface DataClausAuthConfig {
  /** DataClaus API URL (default: http://localhost:3002) */
  apiUrl?: string;
  /** API Key for HMAC authentication (required for some endpoints) */
  apiKey?: string;
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

export interface UserEarnings {
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  qualityScore: number;
}

export interface AdImpressionResult {
  impressionId: string;
  grossRevenue: number;
  userShare: number;
  devShare: number;
  platformFee: number;
  userNewTotal: number;
  distributed: boolean;
}

export interface AdConfig {
  applicationId: string;
  userSharePercent: number;
  devSharePercent: number;
  platformPercent: number;
  enabledAdTypes: ('banner' | 'interstitial' | 'rewarded')[];
  minimumEcpm: number;
}

export interface AdRates {
  banner: { ecpm: number; perImpression: number };
  interstitial: { ecpm: number; perImpression: number };
  rewarded: { ecpm: number; perImpression: number };
  currency: string;
  platformFeePercent: number;
  defaultUserShare: number;
}

export interface AdRevenueSummary {
  totalImpressions: number;
  totalGrossRevenue: number;
  totalUserShare: number;
  totalDevShare: number;
  totalPlatformFee: number;
  averageEcpm: number;
  bannerImpressions: number;
  interstitialCount: number;
  rewardedCount: number;
}

export interface TopEarner {
  userId: string;
  totalImpressions: number;
  estimatedRevenue: number;
  userShare: number;
  revenuePercent: number;
}

interface ErrorResponse {
  error: string;
}

/**
 * DataClaus Authentication Client for Node.js
 *
 * Use this in your backend to verify DataClaus user tokens
 * and access user data.
 */
export class DataClausAuth {
  private config: Required<Omit<DataClausAuthConfig, 'apiKey'>> & { apiKey?: string };

  constructor(config: DataClausAuthConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl || 'http://localhost:3002',
      apiKey: config.apiKey,
    };
  }

  /**
   * Verify a DataClaus user access token.
   * Returns the user profile if valid, null if invalid.
   */
  async verifyToken(accessToken: string): Promise<DataClausUser | null> {
    try {
      const response = await fetch(`${this.config.apiUrl}/auth/user/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        id: string;
        phone: string;
        email?: string;
        display_name?: string;
        avatar_url?: string;
        quality_score: number;
        wallet_id: string;
      };

      return {
        id: data.id,
        phone: data.phone,
        email: data.email,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
        qualityScore: data.quality_score,
        walletId: data.wallet_id,
      };
    } catch {
      return null;
    }
  }

  /**
   * Request OTP for a phone number.
   * This is typically called by end-users, but can be used server-side for testing.
   */
  async requestOTP(phone: string): Promise<{ expiresIn: number; message: string }> {
    const response = await fetch(`${this.config.apiUrl}/auth/user/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as ErrorResponse;
      throw new Error(error.error);
    }

    const data = await response.json() as { expires_in: number; message: string };
    return {
      expiresIn: data.expires_in,
      message: data.message,
    };
  }

  /**
   * Verify OTP and get tokens.
   * Returns access/refresh tokens and user data.
   */
  async verifyOTP(phone: string, code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    isNewUser: boolean;
    user: DataClausUser;
  }> {
    const response = await fetch(`${this.config.apiUrl}/auth/user/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Verification failed' })) as ErrorResponse;
      throw new Error(error.error);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      is_new_user: boolean;
      user: {
        id: string;
        phone: string;
        email?: string;
        display_name?: string;
        avatar_url?: string;
        quality_score: number;
        wallet_id: string;
      };
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      isNewUser: data.is_new_user,
      user: {
        id: data.user.id,
        phone: data.user.phone,
        email: data.user.email,
        displayName: data.user.display_name,
        avatarUrl: data.user.avatar_url,
        qualityScore: data.user.quality_score,
        walletId: data.user.wallet_id,
      },
    };
  }

  /**
   * Get user earnings by user ID.
   * Requires API key for server-side access.
   */
  async getUserEarnings(userId: string): Promise<UserEarnings> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const response = await fetch(`${this.config.apiUrl}/users/${userId}/earnings`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get earnings: ${response.status}`);
    }

    const data = await response.json() as {
      total_earned: number;
      pending_balance: number;
      available_balance: number;
      quality_score: number;
    };

    return {
      totalEarned: data.total_earned,
      pendingBalance: data.pending_balance,
      availableBalance: data.available_balance,
      qualityScore: data.quality_score,
    };
  }

  /**
   * Record an ad impression and distribute revenue.
   * Requires API key.
   */
  async recordAdImpression(
    appId: string,
    userId: string,
    adType: 'banner' | 'interstitial' | 'rewarded',
    grossRevenue?: number,
    options?: {
      adUnitId?: string;
      sessionId?: string;
      deviceInfo?: string;
      countryCode?: string;
    },
  ): Promise<AdImpressionResult> {
    if (!this.config.apiKey) {
      throw new Error('API key required for recording ad impressions');
    }

    const response = await fetch(`${this.config.apiUrl}/applications/${appId}/ads/impression`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        user_id: userId,
        ad_type: adType,
        gross_revenue: grossRevenue || 0,
        currency: 'USD',
        ad_unit_id: options?.adUnitId,
        session_id: options?.sessionId,
        device_info: options?.deviceInfo,
        country_code: options?.countryCode,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' })) as ErrorResponse;
      throw new Error(error.error);
    }

    const data = await response.json() as {
      impression_id: string;
      gross_revenue: number;
      user_share: number;
      dev_share: number;
      platform_fee: number;
      user_new_total: number;
      distributed: boolean;
    };

    return {
      impressionId: data.impression_id,
      grossRevenue: data.gross_revenue,
      userShare: data.user_share,
      devShare: data.dev_share,
      platformFee: data.platform_fee,
      userNewTotal: data.user_new_total,
      distributed: data.distributed,
    };
  }

  /**
   * Get ad configuration for an application.
   * Returns revenue share percentages and enabled ad types.
   */
  async getAdConfig(appId: string): Promise<AdConfig> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const response = await fetch(`${this.config.apiUrl}/applications/${appId}/ads/config`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get ad config: ${response.status}`);
    }

    const data = await response.json() as {
      application_id: string;
      user_share_percent: number;
      dev_share_percent: number;
      platform_percent: number;
      enabled_ad_types: ('banner' | 'interstitial' | 'rewarded')[];
      minimum_ecpm: number;
    };

    return {
      applicationId: data.application_id,
      userSharePercent: data.user_share_percent,
      devSharePercent: data.dev_share_percent,
      platformPercent: data.platform_percent,
      enabledAdTypes: data.enabled_ad_types,
      minimumEcpm: data.minimum_ecpm,
    };
  }

  /**
   * Get current ad rates (eCPM and per-impression values).
   * Public endpoint - no auth required.
   */
  async getAdRates(): Promise<AdRates> {
    const response = await fetch(`${this.config.apiUrl}/ads/rates`);

    if (!response.ok) {
      throw new Error(`Failed to get ad rates: ${response.status}`);
    }

    const data = await response.json() as {
      banner: { ecpm: number; per_impression: number };
      interstitial: { ecpm: number; per_impression: number };
      rewarded: { ecpm: number; per_impression: number };
      currency: string;
      platform_fee_percent: number;
      default_user_share: number;
    };

    return {
      banner: { ecpm: data.banner.ecpm, perImpression: data.banner.per_impression },
      interstitial: { ecpm: data.interstitial.ecpm, perImpression: data.interstitial.per_impression },
      rewarded: { ecpm: data.rewarded.ecpm, perImpression: data.rewarded.per_impression },
      currency: data.currency,
      platformFeePercent: data.platform_fee_percent,
      defaultUserShare: data.default_user_share,
    };
  }

  /**
   * Get revenue summary for an application.
   * Requires API key.
   */
  async getAppRevenueSummary(appId: string, period: 'today' | 'week' | 'month' | 'year' | 'all' = 'month'): Promise<AdRevenueSummary> {
    if (!this.config.apiKey) {
      throw new Error('API key required for revenue summary');
    }

    const response = await fetch(`${this.config.apiUrl}/applications/${appId}/ads/summary?period=${period}`, {
      headers: {
        'X-API-Key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get revenue summary: ${response.status}`);
    }

    const data = await response.json() as {
      total_impressions: number;
      total_gross_revenue: number;
      total_user_share: number;
      total_dev_share: number;
      total_platform_fee: number;
      average_ecpm: number;
      banner_impressions: number;
      interstitial_count: number;
      rewarded_count: number;
    };

    return {
      totalImpressions: data.total_impressions,
      totalGrossRevenue: data.total_gross_revenue,
      totalUserShare: data.total_user_share,
      totalDevShare: data.total_dev_share,
      totalPlatformFee: data.total_platform_fee,
      averageEcpm: data.average_ecpm,
      bannerImpressions: data.banner_impressions,
      interstitialCount: data.interstitial_count,
      rewardedCount: data.rewarded_count,
    };
  }

  /**
   * Get revenue summary for a specific user.
   * Requires API key.
   */
  async getUserRevenueSummary(userId: string, period: 'today' | 'week' | 'month' | 'year' | 'all' = 'month'): Promise<AdRevenueSummary> {
    if (!this.config.apiKey) {
      throw new Error('API key required for user revenue summary');
    }

    const response = await fetch(`${this.config.apiUrl}/users/${userId}/ads/summary?period=${period}`, {
      headers: {
        'X-API-Key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get user revenue summary: ${response.status}`);
    }

    const data = await response.json() as {
      total_impressions: number;
      total_gross_revenue: number;
      total_user_share: number;
      total_dev_share: number;
      total_platform_fee: number;
      average_ecpm: number;
      banner_impressions: number;
      interstitial_count: number;
      rewarded_count: number;
    };

    return {
      totalImpressions: data.total_impressions,
      totalGrossRevenue: data.total_gross_revenue,
      totalUserShare: data.total_user_share,
      totalDevShare: data.total_dev_share,
      totalPlatformFee: data.total_platform_fee,
      averageEcpm: data.average_ecpm,
      bannerImpressions: data.banner_impressions,
      interstitialCount: data.interstitial_count,
      rewardedCount: data.rewarded_count,
    };
  }

  /**
   * Get developer revenue summary.
   * Requires API key.
   */
  async getDevRevenueSummary(developerId: string, period: 'today' | 'week' | 'month' | 'year' | 'all' = 'month'): Promise<AdRevenueSummary> {
    if (!this.config.apiKey) {
      throw new Error('API key required for developer revenue summary');
    }

    const response = await fetch(`${this.config.apiUrl}/developers/${developerId}/ads/summary?period=${period}`, {
      headers: {
        'X-API-Key': this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get developer revenue summary: ${response.status}`);
    }

    const data = await response.json() as {
      total_impressions: number;
      total_gross_revenue: number;
      total_user_share: number;
      total_dev_share: number;
      total_platform_fee: number;
      average_ecpm: number;
      banner_impressions: number;
      interstitial_count: number;
      rewarded_count: number;
    };

    return {
      totalImpressions: data.total_impressions,
      totalGrossRevenue: data.total_gross_revenue,
      totalUserShare: data.total_user_share,
      totalDevShare: data.total_dev_share,
      totalPlatformFee: data.total_platform_fee,
      averageEcpm: data.average_ecpm,
      bannerImpressions: data.banner_impressions,
      interstitialCount: data.interstitial_count,
      rewardedCount: data.rewarded_count,
    };
  }
}

export default DataClausAuth;

