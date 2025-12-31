/**
 * DataClaus Service
 *
 * Wraps the @dataclaus/sdk-node client for NestJS dependency injection.
 * Handles all communication with the DataClaus API.
 *
 * This service demonstrates how developers integrate the DataClaus SDK
 * into their backend applications.
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataClausClient } from '@dataclaus/sdk-node';
import * as crypto from 'crypto';

// Response type definitions for DataClaus API
interface VerifyTokenResponse {
  user_id: string;
  phone: string;
  email?: string;
  quality_score: number;
  wallet_id: string;
}

interface AdImpressionResponse {
  impression_id: string;
  user_share: number;
  dev_share: number;
  platform_fee: number;
  user_new_total: number;
}

interface ErrorResponse {
  error: string;
}

interface EarningsResponse {
  total_earned: number;
  pending_balance: number;
  available_balance: number;
  quality_score: number;
}

interface RecaptchaResponse {
  is_bot: boolean;
  score: number;
  reasons?: string[];
}

export interface UserTokenPayload {
  userId: string;
  phone: string;
  email?: string;
  qualityScore: number;
  walletId: string;
}

export interface AdImpressionResult {
  impressionId: string;
  userShare: number;
  devShare: number;
  platformFee: number;
  userNewTotal: number;
}

export interface UserEarnings {
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  qualityScore: number;
}

@Injectable()
export class DataClausService implements OnModuleInit {
  private readonly logger = new Logger(DataClausService.name);
  private client: DataClausClient | null = null;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly appId: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>(
      'DATACLAUS_API_URL',
      'http://localhost:7000',
    );
    this.apiKey = this.configService.get<string>('DATACLAUS_API_KEY', '');
    this.apiSecret = this.configService.get<string>('DATACLAUS_API_SECRET', '');
    this.appId = this.configService.get<string>('DATACLAUS_APP_ID', '');
  }

  onModuleInit(): void {
    if (!this.apiKey) {
      this.logger.warn(
        'DATACLAUS_API_KEY not configured. SDK features will not work.',
      );
      return;
    }

    this.client = new DataClausClient({
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
      developerId: this.appId,
    });

    this.logger.log(`DataClaus SDK initialized - API: ${this.apiUrl}`);
  }

  /**
   * Verify a DataClaus user token from mobile app.
   * Returns the user payload if valid.
   */
  async verifyUserToken(token: string): Promise<UserTokenPayload | null> {
    if (!this.apiKey) {
      throw new Error('DataClaus API key not configured');
    }

    try {
      const response = await fetch(`${this.apiUrl}/auth/user/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        this.logger.warn(`Token verification failed: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as VerifyTokenResponse;
      return {
        userId: data.user_id,
        phone: data.phone,
        email: data.email,
        qualityScore: data.quality_score,
        walletId: data.wallet_id,
      };
    } catch (error) {
      this.logger.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Record an ad impression and distribute revenue.
   * Called when a user views an ad in the app.
   */
  async recordAdImpression(
    userId: string,
    adType: 'banner' | 'interstitial' | 'rewarded',
    grossRevenue: number,
  ): Promise<AdImpressionResult> {
    if (!this.apiKey) {
      throw new Error('DataClaus API key not configured');
    }

    const response = await fetch(
      `${this.apiUrl}/applications/${this.appId}/ads/impression`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Signature': this.generateSignature({
            userId,
            adType,
            grossRevenue,
          }),
        },
        body: JSON.stringify({
          user_id: userId,
          ad_type: adType,
          gross_revenue: grossRevenue,
          currency: 'USD',
        }),
      },
    );

    if (!response.ok) {
      const errorData = (await response
        .json()
        .catch(() => ({ error: 'Unknown error' }))) as ErrorResponse;
      throw new Error(`Ad impression failed: ${errorData.error}`);
    }

    const data = (await response.json()) as AdImpressionResponse;
    return {
      impressionId: data.impression_id,
      userShare: data.user_share,
      devShare: data.dev_share,
      platformFee: data.platform_fee,
      userNewTotal: data.user_new_total,
    };
  }

  /**
   * Get user earnings from DataClaus.
   */
  async getUserEarnings(userId: string): Promise<UserEarnings> {
    if (!this.apiKey) {
      throw new Error('DataClaus API key not configured');
    }

    const response = await fetch(`${this.apiUrl}/users/${userId}/earnings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get earnings: ${response.status}`);
    }

    const data = (await response.json()) as EarningsResponse;
    return {
      totalEarned: data.total_earned,
      pendingBalance: data.pending_balance,
      availableBalance: data.available_balance,
      qualityScore: data.quality_score,
    };
  }

  /**
   * Verify reCAPTCHA token through DataClaus backend.
   * DataClaus handles the Google Cloud API call.
   */
  async verifyRecaptcha(
    token: string,
    action: string,
    userIpAddress?: string,
  ): Promise<{ isBot: boolean; score: number; reasons: string[] }> {
    if (!this.apiKey) {
      throw new Error('DataClaus API key not configured');
    }

    const response = await fetch(`${this.apiUrl}/recaptcha/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        token,
        action,
        user_ip_address: userIpAddress,
        site_key: this.configService.get<string>('RECAPTCHA_SITE_KEY'),
      }),
    });

    if (!response.ok) {
      this.logger.error('reCAPTCHA verification failed');
      // Fail open for now - log but allow
      return { isBot: false, score: 0.5, reasons: ['verification_error'] };
    }

    const data = (await response.json()) as RecaptchaResponse;
    return {
      isBot: data.is_bot,
      score: data.score,
      reasons: data.reasons || [],
    };
  }

  /**
   * Forward sensor data to DataClaus for quality scoring.
   */
  async forwardSensorData(
    userId: string,
    events: Array<{
      eventType: string;
      timestamp: string;
      payload: Record<string, unknown>;
    }>,
  ): Promise<{ eventsReceived: number }> {
    if (!this.client) {
      throw new Error('DataClaus client not initialized');
    }

    // Use SDK to send batch of events
    const result = await this.client.ingestBatch(
      events.map((event) => ({
        userId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        payload: event.payload,
      })),
    );

    return { eventsReceived: result.processedCount };
  }

  /**
   * Generate HMAC signature for API calls.
   */
  private generateSignature(payload: Record<string, unknown>): string {
    const data = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(data)
      .digest('hex');
  }

  /**
   * Check if DataClaus SDK is properly configured.
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.appId;
  }

  /**
   * Get the application ID.
   */
  getAppId(): string {
    return this.appId;
  }
}
