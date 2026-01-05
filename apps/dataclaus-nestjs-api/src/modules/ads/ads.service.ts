import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdImpression } from './entities/ad-impression.entity';
import { Application } from '../application/entities/application.entity';
import {
  RecordImpressionDto,
  AdRatesResponseDto,
  AdRevenueSummaryDto,
  AdConfigResponseDto,
  ImpressionResponseDto,
} from './dto';
import {
  AdType,
  ECPM_BANNER,
  ECPM_INTERSTITIAL,
  ECPM_REWARDED,
  PLATFORM_FEE_PERCENT,
  DEFAULT_USER_SHARE_PERCENT,
  MIN_USER_SHARE_PERCENT,
  MAX_USER_SHARE_PERCENT,
} from '../../common/constants';

import { WalletService } from '../wallet/wallet.service';
import { LedgerService } from '../ledger/ledger.service';
import { TransactionType, TransactionStatus } from '../../common/constants';

@Injectable()
export class AdsService {
  constructor(
    @InjectRepository(AdImpression)
    private readonly impressionRepository: Repository<AdImpression>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService,
  ) {}

  getAdRates(): AdRatesResponseDto {
    return {
      banner_ecpm: ECPM_BANNER,
      interstitial_ecpm: ECPM_INTERSTITIAL,
      rewarded_ecpm: ECPM_REWARDED,
    };
  }

  async recordImpression(
    appId: string,
    dto: RecordImpressionDto,
  ): Promise<ImpressionResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id: appId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const grossRevenue =
      dto.gross_revenue || AdImpression.getRevenuePerImpression(dto.ad_type);

    const userSharePercent =
      application.userSharePercent > 0
        ? application.userSharePercent
        : DEFAULT_USER_SHARE_PERCENT;

    const { userShare, devShare, platformFee } = this.calculateRevenueSplit(
      grossRevenue,
      userSharePercent,
    );

    const impression = this.impressionRepository.create({
      applicationId: appId,
      userId: dto.user_id,
      developerId: application.developerId,
      adType: dto.ad_type,
      adUnitId: dto.ad_unit_id || null,
      grossRevenue,
      userShare,
      devShare,
      platformFee,
      sessionId: dto.session_id || null,
      distributed: true,
      distributedAt: new Date(),
    });

    await this.impressionRepository.save(impression);

    // Update Application Stats
    try {
      application.totalEvents = Number(application.totalEvents) + 1;
      application.totalRevenue =
        Number(application.totalRevenue) + Number(grossRevenue);
      application.lastEventAt = new Date();

      // Check if this is a new unique user for this application
      const previousUserImpressions = await this.impressionRepository.count({
        where: {
          applicationId: appId,
          userId: dto.user_id,
        },
      });

      // If this is their first impression (count is 1 because we just saved it), it's a new user
      if (previousUserImpressions === 1) {
        application.totalUsers = Number(application.totalUsers) + 1;
        console.log(
          `[Ads] New unique user for app ${appId}, total users: ${application.totalUsers}`,
        );
      }

      await this.applicationRepository.save(application);
      console.log(
        `[Ads] Updated app stats: events=${application.totalEvents}, revenue=${application.totalRevenue}, users=${application.totalUsers}`,
      );
    } catch (e) {
      console.error('[Ads] Failed to update application stats:', e);
    }

    // --- REVENUE DISTRIBUTION LOGIC ---
    try {
      // 1. Credit User Share
      if (userShare > 0) {
        const userWallets = await this.walletService.findByOwner(dto.user_id);
        console.log(
          `[Ads] Found ${userWallets?.length || 0} wallets for user ${dto.user_id}`,
        );

        if (userWallets && userWallets.length > 0) {
          // Assuming the first wallet is the primary one
          const userWalletId = userWallets[0].id;
          await this.walletService.credit(userWalletId, {
            amount: userShare,
          });

          // Record Ledger
          await this.ledgerService.recordTransaction({
            sourceWalletId: '00000000-0000-0000-0000-000000000000', // System/Platform Wallet ID (Placeholder)
            destWalletId: userWalletId,
            amount: userShare,
            currency: 'USD',
            referenceId: impression.id,
            type: TransactionType.AD_REVENUE,
            status: TransactionStatus.COMPLETED,
          });
        } else {
          console.warn(
            `[Ads] No wallet found for user ${dto.user_id}, skipping share.`,
          );
        }
      }

      // 2. Credit Developer Share
      if (devShare > 0) {
        const devWallets = await this.walletService.findByOwner(
          application.developerId,
        );
        console.log(
          `[Ads] Found ${devWallets?.length || 0} wallets for developer ${application.developerId}`,
        );

        if (devWallets && devWallets.length > 0) {
          const devWalletId = devWallets[0].id;
          await this.walletService.credit(devWalletId, {
            amount: devShare,
          });

          // Record Ledger
          await this.ledgerService.recordTransaction({
            sourceWalletId: '00000000-0000-0000-0000-000000000000', // System/Platform Wallet
            destWalletId: devWalletId,
            amount: devShare,
            currency: 'USD',
            referenceId: impression.id,
            type: TransactionType.AD_REVENUE,
            status: TransactionStatus.COMPLETED,
          });
        } else {
          console.warn(
            `[Ads] No wallet found for developer ${application.developerId}, skipping share.`,
          );
        }
      }
    } catch (error) {
      console.error('Error distributing revenue:', error);
      // Don't fail the request, just log it. We can have a background job retry later if 'distributed' is false.
      // But for now we mark it distributed above, which is risky if this fails.
      // Ideally, we should set distributed=true only if this block succeeds.
      impression.distributed = false;
      impression.distributedAt = null;
      await this.impressionRepository.save(impression);
    }

    return this.toImpressionResponse(impression);
  }

  async getAdConfig(appId: string): Promise<AdConfigResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id: appId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const userSharePercent =
      application.userSharePercent > 0
        ? application.userSharePercent
        : DEFAULT_USER_SHARE_PERCENT;

    return {
      application_id: application.id,
      user_share_percent: userSharePercent,
      dev_share_percent: 100 - PLATFORM_FEE_PERCENT - userSharePercent,
      platform_percent: PLATFORM_FEE_PERCENT,
      enabled_ad_types: [AdType.BANNER, AdType.INTERSTITIAL, AdType.REWARDED],
      minimum_ecpm: 0.1,
    };
  }

  async getApplicationRevenueSummary(
    appId: string,
  ): Promise<AdRevenueSummaryDto> {
    const impressions = await this.impressionRepository.find({
      where: { applicationId: appId },
    });

    return this.calculateSummary(impressions);
  }

  async getUserRevenueSummary(userId: string): Promise<AdRevenueSummaryDto> {
    const impressions = await this.impressionRepository.find({
      where: { userId },
    });

    return this.calculateSummary(impressions);
  }

  async getDeveloperRevenueSummary(
    developerId: string,
  ): Promise<AdRevenueSummaryDto> {
    const impressions = await this.impressionRepository.find({
      where: { developerId },
    });

    return this.calculateSummary(impressions);
  }

  private calculateRevenueSplit(
    grossRevenue: number,
    userSharePercent: number,
  ): { userShare: number; devShare: number; platformFee: number } {
    if (userSharePercent < MIN_USER_SHARE_PERCENT) {
      userSharePercent = MIN_USER_SHARE_PERCENT;
    }
    if (userSharePercent > MAX_USER_SHARE_PERCENT) {
      userSharePercent = MAX_USER_SHARE_PERCENT;
    }

    const devSharePercent = 100 - PLATFORM_FEE_PERCENT - userSharePercent;

    return {
      platformFee: (grossRevenue * PLATFORM_FEE_PERCENT) / 100,
      userShare: (grossRevenue * userSharePercent) / 100,
      devShare: (grossRevenue * devSharePercent) / 100,
    };
  }

  private calculateSummary(impressions: AdImpression[]): AdRevenueSummaryDto {
    let totalGrossRevenue = 0;
    let totalUserShare = 0;
    let totalDevShare = 0;
    let totalPlatformFee = 0;
    let bannerImpressions = 0;
    let interstitialCount = 0;
    let rewardedCount = 0;

    for (const impression of impressions) {
      totalGrossRevenue += Number(impression.grossRevenue);
      totalUserShare += Number(impression.userShare);
      totalDevShare += Number(impression.devShare);
      totalPlatformFee += Number(impression.platformFee);

      switch (impression.adType) {
        case AdType.BANNER:
          bannerImpressions++;
          break;
        case AdType.INTERSTITIAL:
          interstitialCount++;
          break;
        case AdType.REWARDED:
          rewardedCount++;
          break;
      }
    }

    const totalImpressions = impressions.length;
    const averageEcpm =
      totalImpressions > 0 ? (totalGrossRevenue / totalImpressions) * 1000 : 0;

    return {
      total_impressions: totalImpressions,
      total_gross_revenue: totalGrossRevenue,
      total_user_share: totalUserShare,
      total_dev_share: totalDevShare,
      total_platform_fee: totalPlatformFee,
      average_ecpm: averageEcpm,
      banner_impressions: bannerImpressions,
      interstitial_count: interstitialCount,
      rewarded_count: rewardedCount,
    };
  }

  private toImpressionResponse(
    impression: AdImpression,
  ): ImpressionResponseDto {
    return {
      id: impression.id,
      application_id: impression.applicationId,
      user_id: impression.userId,
      developer_id: impression.developerId,
      ad_type: impression.adType,
      gross_revenue: Number(impression.grossRevenue),
      user_share: Number(impression.userShare),
      dev_share: Number(impression.devShare),
      platform_fee: Number(impression.platformFee),
      created_at: impression.createdAt,
    };
  }

  /**
   * Sync application stats from existing impressions
   * This recalculates total_events, total_users, total_revenue from ad_impressions table
   */
  async syncApplicationStats(appId: string): Promise<{
    total_events: number;
    total_users: number;
    total_revenue: number;
    synced: boolean;
  }> {
    const application = await this.applicationRepository.findOne({
      where: { id: appId },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Count total impressions
    const totalEvents = await this.impressionRepository.count({
      where: { applicationId: appId },
    });

    // Count unique users
    const uniqueUsersResult = await this.impressionRepository
      .createQueryBuilder('impression')
      .select('COUNT(DISTINCT impression.userId)', 'count')
      .where('impression.applicationId = :appId', { appId })
      .getRawOne();
    const totalUsers = parseInt(uniqueUsersResult?.count || '0', 10);

    // Sum total revenue
    const revenueResult = await this.impressionRepository
      .createQueryBuilder('impression')
      .select('COALESCE(SUM(impression.grossRevenue), 0)', 'total')
      .where('impression.applicationId = :appId', { appId })
      .getRawOne();
    const totalRevenue = parseFloat(revenueResult?.total || '0');

    // Get last event timestamp
    const lastImpression = await this.impressionRepository.findOne({
      where: { applicationId: appId },
      order: { createdAt: 'DESC' },
    });

    // Update application
    application.totalEvents = totalEvents;
    application.totalUsers = totalUsers;
    application.totalRevenue = totalRevenue;
    if (lastImpression) {
      application.lastEventAt = lastImpression.createdAt;
    }

    await this.applicationRepository.save(application);

    console.log(
      `[Ads] Synced app ${appId} stats: events=${totalEvents}, users=${totalUsers}, revenue=${totalRevenue}`,
    );

    return {
      total_events: totalEvents,
      total_users: totalUsers,
      total_revenue: totalRevenue,
      synced: true,
    };
  }
}
