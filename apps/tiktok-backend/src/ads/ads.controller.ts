/**
 * Ads Controller
 *
 * Proxies ad impression calls to the DataClaus Go API.
 * Impressions are stored in PostgreSQL via the Go API.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  InternalServerErrorException,
} from '@nestjs/common';
import { IsIn, IsOptional, IsNumber } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard';

class RecordImpressionDto {
  @IsIn(['banner', 'interstitial', 'rewarded'])
  adType!: 'banner' | 'interstitial' | 'rewarded';

  @IsOptional()
  @IsNumber()
  grossRevenue?: number;
}

@Controller('ads')
export class AdsController {
  private readonly goApiUrl: string;
  private readonly appId: string;

  constructor(private readonly config: ConfigService) {
    this.goApiUrl =
      this.config.get('DATACLAUS_API_URL') || 'http://localhost:3000';
    this.appId =
      this.config.get('DATACLAUS_APP_ID') ||
      'fd6036a9-d4f4-448a-9712-2dc1ea429903';

    if (!this.appId) {
      console.warn(
        '[ADS] ⚠️ DATACLAUS_APP_ID not set! Ad impressions will fail.',
      );
    } else {
      console.log('[ADS] Using application ID:', this.appId);
    }
  }

  /**
   * Record an ad impression - calls the real Go API
   * Impressions are persisted to PostgreSQL
   */
  @Post('impression')
  @UseGuards(AuthGuard)
  async recordImpression(
    @Body() dto: RecordImpressionDto,
    @Request() req: { user: { id: string; email: string }; token: string },
  ) {
    const userId = req.user.id;
    const adType = dto.adType;

    console.log(
      '[ADS] Debug - Authenticated User:',
      JSON.stringify(req.user, null, 2),
    );
    console.log('[ADS] Debug - Token:', req.token ? 'Present' : 'Missing');
    console.log('[ADS] Debug - User ID:', userId);

    try {
      // Call the DataClaus API to record impression
      const response = await fetch(
        `${this.goApiUrl}/applications/${this.appId}/ads/impression`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${req.token}`,
          },
          body: JSON.stringify({
            user_id: userId,
            ad_type: adType,
            gross_revenue: dto.grossRevenue,
            // Not sending camelCase properties anymore to avoid 'property should not exist' error
          }),
        },
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }));
        console.error('[ADS] Go API error:', error);

        // If application not found, we need to create one first
        if (error.error === 'Application not found') {
          throw new InternalServerErrorException(
            'Demo application not configured. Please create an application in the Go API first.',
          );
        }

        throw new InternalServerErrorException(
          error.error || 'Failed to record impression',
        );
      }

      const result = await response.json();
      console.log(
        `[ADS] Impression recorded response:`,
        JSON.stringify(result, null, 2),
      );

      return {
        success: true,
        impressionId: result.id || result.impression_id,
        adType,
        grossRevenue: result.gross_revenue,
        userShare: result.user_share,
        devShare: result.dev_share,
        platformFee: result.platform_fee,
        userNewTotal: result.user_new_total,
        distributed: result.distributed,
      };
    } catch (error) {
      console.error('[ADS] Failed to record impression:', error);
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(
        'Failed to connect to DataClaus API',
      );
    }
  }

  /**
   * Get user's total earnings from the Go API
   */
  @Get('my-total')
  @UseGuards(AuthGuard)
  async getMyTotal(@Request() req: { user: { id: string }; token: string }) {
    const userId = req.user.id;

    try {
      // Call Go API for user's revenue summary
      const response = await fetch(
        `${this.goApiUrl}/users/${userId}/ads/summary`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${req.token}`,
          },
        },
      );

      if (!response.ok) {
        console.error(
          `[Earnings] Failed to fetch earnings: ${response.status} ${response.statusText}`,
        );
        return { userId, totalEarned: 0, currency: 'USD' };
      }

      const summary = await response.json();
      return {
        userId,
        totalEarned: summary.total_user_share || 0,
        totalImpressions: summary.total_impressions || 0,
        currency: 'USD',
      };
    } catch (error) {
      console.error('[Earnings] Error fetching earnings:', error);
      return { userId, totalEarned: 0, currency: 'USD' };
    }
  }

  /**
   * Get ad rates (eCPM) from Go API
   */
  @Get('rates')
  async getAdRates() {
    try {
      const response = await fetch(`${this.goApiUrl}/ads/rates`);
      if (!response.ok) {
        return this.getDefaultRates();
      }
      return await response.json();
    } catch {
      return this.getDefaultRates();
    }
  }

  private getDefaultRates() {
    return {
      banner: { ecpm: 0.5, per_impression: 0.0005 },
      interstitial: { ecpm: 5.0, per_impression: 0.005 },
      rewarded: { ecpm: 15.0, per_impression: 0.015 },
      currency: 'USD',
    };
  }
}
