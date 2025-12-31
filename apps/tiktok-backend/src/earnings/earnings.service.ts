/**
 * Earnings Service
 *
 * Manages ad impressions and user earnings.
 * All data flows through DataClaus API.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  DataClausService,
  AdImpressionResult,
  UserEarnings,
} from '../dataclaus/dataclaus.service';

export interface RecordImpressionParams {
  userId: string;
  adType: 'banner' | 'interstitial' | 'rewarded';
  estimatedRevenue: number;
}

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(private readonly dataclausService: DataClausService) {}

  /**
   * Record an ad impression and distribute revenue.
   * This is called when a user views an ad in the app.
   *
   * Revenue split:
   * - User: 50-90% (configurable per app)
   * - Developer: 5-45% (remaining after user share)
   * - Platform: 5% (fixed)
   */
  async recordAdImpression(
    params: RecordImpressionParams,
  ): Promise<AdImpressionResult> {
    this.logger.log(
      `Recording ${params.adType} impression for user ${params.userId}, revenue: $${params.estimatedRevenue}`,
    );

    const result = await this.dataclausService.recordAdImpression(
      params.userId,
      params.adType,
      params.estimatedRevenue,
    );

    this.logger.log(
      `Impression recorded: User earned $${result.userShare}, Dev earned $${result.devShare}`,
    );

    return result;
  }

  /**
   * Get user earnings summary from DataClaus.
   */
  async getUserEarnings(userId: string): Promise<UserEarnings> {
    return this.dataclausService.getUserEarnings(userId);
  }

  /**
   * Get estimated revenue for different ad types.
   * In production, this would come from real ad network data.
   */
  getAdRevenue(adType: 'banner' | 'interstitial' | 'rewarded'): number {
    // eCPM values (earnings per 1000 impressions) in USD
    const eCPM: Record<string, number> = {
      banner: 0.5, // $0.50 per 1000 views = $0.0005 per view
      interstitial: 5.0, // $5.00 per 1000 views = $0.005 per view
      rewarded: 15.0, // $15.00 per 1000 views = $0.015 per view
    };

    return (eCPM[adType] || 0.5) / 1000;
  }
}
