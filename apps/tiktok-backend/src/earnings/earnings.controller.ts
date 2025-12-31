/**
 * Earnings Controller
 *
 * API endpoints for earnings and ad impressions.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { EarningsService } from './earnings.service';
import { AuthService } from '../auth/auth.service';
import {
  AdImpressionResult,
  UserEarnings,
} from '../dataclaus/dataclaus.service';

class RecordImpressionDto {
  adType!: 'banner' | 'interstitial' | 'rewarded';
  estimatedRevenue?: number;
}

@Controller('earnings')
export class EarningsController {
  constructor(
    private readonly earningsService: EarningsService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Get current user's earnings summary.
   * Requires authentication.
   */
  @Get('summary')
  async getSummary(
    @Headers('authorization') authHeader: string,
  ): Promise<UserEarnings> {
    const user = await this.getUser(authHeader);
    return this.earningsService.getUserEarnings(user.id);
  }

  /**
   * Record an ad impression.
   * Called when user views an ad in the app.
   * Requires authentication.
   */
  @Post('ad-impression')
  async recordImpression(
    @Body() dto: RecordImpressionDto,
    @Headers('authorization') authHeader: string,
  ): Promise<AdImpressionResult & { success: boolean }> {
    const user = await this.getUser(authHeader);

    // Get estimated revenue if not provided
    const revenue =
      dto.estimatedRevenue ?? this.earningsService.getAdRevenue(dto.adType);

    const result = await this.earningsService.recordAdImpression({
      userId: user.id,
      adType: dto.adType,
      estimatedRevenue: revenue,
    });

    return { success: true, ...result };
  }

  /**
   * Get ad revenue rates.
   * Public endpoint for app to show expected earnings.
   */
  @Get('ad-rates')
  getAdRates(): {
    banner: number;
    interstitial: number;
    rewarded: number;
    currency: string;
  } {
    return {
      banner: this.earningsService.getAdRevenue('banner'),
      interstitial: this.earningsService.getAdRevenue('interstitial'),
      rewarded: this.earningsService.getAdRevenue('rewarded'),
      currency: 'USD',
    };
  }

  /**
   * Helper to verify user from auth header.
   */
  private async getUser(authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization required');
    }
    const token = authHeader.replace('Bearer ', '');
    return this.authService.verifyToken(token);
  }
}
