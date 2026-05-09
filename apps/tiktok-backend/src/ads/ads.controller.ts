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
   * Record an ad impression. Internally runs the bypass-resistant
   * slot/seal flow against the DataClaus API:
   *   1. POST /ads/slot   → server-issued signed token
   *   2. POST /ads/seal   → atomic ledger transfer
   *
   * Mobile callers see a single round-trip; the proxy hides the two-step
   * crypto handshake.
   */
  @Post('impression')
  @UseGuards(AuthGuard)
  async recordImpression(
    @Body() dto: RecordImpressionDto,
    @Request() req: { user: { id: string; email: string }; token: string },
  ) {
    const userId = req.user.id;
    const adType = dto.adType;

    try {
      // STEP 1 — request a signed slot
      const slotResponse = await fetch(
        `${this.goApiUrl}/applications/${this.appId}/ads/slot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${req.token}`,
          },
          body: JSON.stringify({
            ad_type: adType,
            user_id: userId,
          }),
        },
      );

      if (!slotResponse.ok) {
        const err = await slotResponse
          .json()
          .catch(() => ({ error: 'Slot request failed' }));
        console.error('[ADS] Slot request error:', err);
        if (err.error === 'Application not found') {
          throw new InternalServerErrorException(
            'Demo application not configured. Create an application in the DataClaus API first.',
          );
        }
        throw new InternalServerErrorException(
          err.error || 'Failed to obtain ad slot',
        );
      }

      const slot = await slotResponse.json();

      // STEP 2 — seal the impression
      const sealResponse = await fetch(
        `${this.goApiUrl}/applications/${this.appId}/ads/seal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${req.token}`,
          },
          body: JSON.stringify({
            slot_token: slot.slot_token,
            reported_revenue: dto.grossRevenue,
          }),
        },
      );

      if (!sealResponse.ok) {
        const err = await sealResponse
          .json()
          .catch(() => ({ error: 'Seal failed' }));
        console.error('[ADS] Seal error:', err);
        throw new InternalServerErrorException(
          err.error || 'Failed to seal impression',
        );
      }

      const result = await sealResponse.json();
      console.log(
        `[ADS] Impression sealed (${adType}):`,
        JSON.stringify(result, null, 2),
      );

      return {
        success: true,
        impressionId: result.id,
        adType,
        grossRevenue: result.gross_revenue,
        userShare: result.user_share,
        devShare: result.dev_share,
        platformFee: result.platform_fee,
        userNewTotal: result.user_new_total,
        distributed: true,
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
   * Public passthrough for SDK clients that want to drive the slot/seal
   * cycle directly. Mobile has not been migrated yet — keep this for
   * forward-looking integrations.
   */
  @Post('slot')
  @UseGuards(AuthGuard)
  async requestSlot(
    @Body() dto: RecordImpressionDto,
    @Request() req: { user: { id: string }; token: string },
  ) {
    const response = await fetch(
      `${this.goApiUrl}/applications/${this.appId}/ads/slot`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${req.token}`,
        },
        body: JSON.stringify({ ad_type: dto.adType, user_id: req.user.id }),
      },
    );
    if (!response.ok) {
      throw new InternalServerErrorException('Slot request failed');
    }
    return response.json();
  }

  @Post('seal')
  @UseGuards(AuthGuard)
  async sealImpression(
    @Body() body: { slotToken: string; reportedRevenue?: number; completed?: boolean },
    @Request() req: { token: string },
  ) {
    const response = await fetch(
      `${this.goApiUrl}/applications/${this.appId}/ads/seal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${req.token}`,
        },
        body: JSON.stringify({
          slot_token: body.slotToken,
          reported_revenue: body.reportedRevenue,
          completed: body.completed,
        }),
      },
    );
    if (!response.ok) {
      throw new InternalServerErrorException('Seal failed');
    }
    return response.json();
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
