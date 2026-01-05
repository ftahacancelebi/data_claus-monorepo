/**
 * Earnings Controller
 *
 * Fetches user earnings from the DataClaus Go API (PostgreSQL).
 */

import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/auth.guard';

@Controller('earnings')
export class EarningsController {
  private readonly goApiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.goApiUrl =
      this.config.get('DATACLAUS_API_URL') || 'http://localhost:3000';
  }

  /**
   * Get user's earnings summary from the Go API (real database)
   */
  @Get('summary')
  @UseGuards(AuthGuard)
  async getSummary(@Request() req: { user: { id: string }; token: string }) {
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
        console.log(
          `[Earnings] No data for user ${userId}: ${response.status}`,
        );
        return this.getEmptyEarnings();
      }

      const summary = await response.json();
      console.log(
        `[Earnings] User ${userId} summary from DB:`,
        JSON.stringify(summary),
      );

      // Also try to get wallet balance
      let walletBalance = 0;
      try {
        const walletResponse = await fetch(
          `${this.goApiUrl}/wallets/owner/${userId}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${req.token}`,
            },
          },
        );
        if (walletResponse.ok) {
          const wallets = await walletResponse.json();
          if (Array.isArray(wallets) && wallets.length > 0) {
            walletBalance = Number(wallets[0].balance) || 0;
          } else if (!Array.isArray(wallets)) {
            walletBalance = Number(wallets.balance) || 0;
          }
        }
      } catch (e) {
        console.error('[Earnings] Failed to fetch wallet:', e);
      }

      return {
        totalEarned: summary.total_user_share || 0,
        availableBalance: walletBalance,
        pendingBalance: (summary.total_user_share || 0) - walletBalance,
        totalImpressions: summary.total_impressions || 0,
        qualityScore: 0.85, // TODO: Get from user profile
        currency: 'USD',
        breakdown: {
          banner: summary.by_type?.banner || { count: 0, revenue: 0 },
          interstitial: summary.by_type?.interstitial || {
            count: 0,
            revenue: 0,
          },
          rewarded: summary.by_type?.rewarded || { count: 0, revenue: 0 },
        },
      };
    } catch (error) {
      console.error('[Earnings] Failed to fetch from Go API:', error);
      return this.getEmptyEarnings();
    }
  }

  /**
   * Get ad revenue rates
   */
  @Get('ad-rates')
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

  /**
   * Release pending earnings to available balance
   */
  @Post('release') // Assuming client calls POST /api/earnings/release
  @UseGuards(AuthGuard)
  async releaseEarnings(
    @Request() req: { user: { id: string }; token: string },
  ) {
    const userId = req.user.id;

    try {
      // 1. Get wallet first
      const walletResponse = await fetch(
        `${this.goApiUrl}/wallets/owner/${userId}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${req.token}` },
        },
      );

      if (!walletResponse.ok) {
        throw new Error('Wallet not found');
      }

      const wallets = await walletResponse.json();
      let walletId: string | null = null;

      if (Array.isArray(wallets) && wallets.length > 0) {
        walletId = wallets[0].id;
      } else if (!Array.isArray(wallets) && wallets.id) {
        walletId = wallets.id;
      }

      if (!walletId) {
        throw new Error('No wallet found for user');
      }

      // 2. Call release-pending
      const releaseResponse = await fetch(
        `${this.goApiUrl}/wallets/${walletId}/release-pending`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${req.token}` },
        },
      );

      if (!releaseResponse.ok) {
        const error = await releaseResponse.json();
        throw new Error(error.message || 'Failed to release earnings');
      }

      return await releaseResponse.json();
    } catch (error) {
      console.error('[Earnings] Release failed:', error);
      return { success: false, error: 'Release failed' };
    }
  }

  private getEmptyEarnings() {
    return {
      totalEarned: 0,
      availableBalance: 0,
      pendingBalance: 0,
      totalImpressions: 0,
      qualityScore: 0.85,
      currency: 'USD',
    };
  }

  private getDefaultRates() {
    return {
      banner: 0.0005,
      interstitial: 0.005,
      rewarded: 0.015,
      currency: 'USD',
    };
  }
}
