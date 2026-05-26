import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdImpression } from './entities/ad-impression.entity';
import { AdCreative } from './entities/ad-creative.entity';
import { Application } from '../application/entities/application.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import {
  RecordImpressionDto,
  AdRatesResponseDto,
  AdRevenueSummaryDto,
  AdConfigResponseDto,
  ImpressionResponseDto,
  SealImpressionDto,
  ServeAdResponseDto,
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
  SYSTEM_WALLET_IDS,
  TransactionType,
  CampaignStatus,
  CampaignTargeting,
} from '../../common/constants';

import { FinancialTxService } from '../ledger/financial-tx.service';
import { CampaignMatcherService } from '../campaign/campaign-matcher.service';
import { AdMediationService } from './ad-mediation.service';
import { ConflictException } from '@nestjs/common';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    @InjectRepository(AdImpression)
    private readonly impressionRepository: Repository<AdImpression>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(AdCreative)
    private readonly creativeRepository: Repository<AdCreative>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly financialTx: FinancialTxService,
    private readonly campaignMatcher: CampaignMatcherService,
    private readonly mediation: AdMediationService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  getAdRates(): AdRatesResponseDto {
    return {
      banner_ecpm: ECPM_BANNER,
      interstitial_ecpm: ECPM_INTERSTITIAL,
      rewarded_ecpm: ECPM_REWARDED,
    };
  }

  /**
   * INTERNAL/ADMIN PATH ONLY.
   *
   * Public SDK callers MUST use the slot/seal flow (`sealImpression`). This
   * method trusts `dto.gross_revenue` and is intended for admin tooling,
   * server-to-server reconciliation, and the migration window. Do NOT expose
   * this on a public, unauthenticated route.
   */
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

    const userSharePercent =
      application.userSharePercent > 0
        ? application.userSharePercent
        : DEFAULT_USER_SHARE_PERCENT;

    const fallbackRevenue =
      dto.gross_revenue || AdImpression.getRevenuePerImpression(dto.ad_type);

    // Resolve target wallets BEFORE the transaction so we fail fast.
    const userWallet = await this.walletRepository.findOne({
      where: { ownerId: dto.user_id },
    });
    const devWallet = await this.walletRepository.findOne({
      where: { ownerId: application.developerId },
    });

    // Single atomic transaction: campaign auction + impression row + paired
    // ledger transfers. `distributed` flag is only set true on successful
    // commit.
    const persisted = await this.financialTx.runInTransaction(async (qr) => {
      // 0. Campaign auction (Phase 6). If a campaign matches, its bid funds
      //    the impression and the buyer wallet is debited atomically. If no
      //    campaign matches, fall back to default eCPM (system AD_NETWORK
      //    wallet absorbs the cost — capstone simulation behaviour).
      const matched = await this.campaignMatcher.matchAndCharge(qr, {
        applicationId: appId,
        application,
        userId: dto.user_id,
        qualityScore:
          typeof dto.quality_score === 'number' ? dto.quality_score : 1,
      });

      const grossRevenue = matched ? matched.bidAmount : fallbackRevenue;
      const { userShare, devShare, platformFee } = this.calculateRevenueSplit(
        grossRevenue,
        userSharePercent,
      );

      const impression = qr.manager.create(AdImpression, {
        applicationId: appId,
        userId: dto.user_id,
        developerId: application.developerId,
        campaignId: matched?.campaignId ?? null,
        adType: dto.ad_type,
        adUnitId: dto.ad_unit_id || null,
        grossRevenue,
        userShare,
        devShare,
        platformFee,
        sessionId: dto.session_id || null,
        distributed: false,
        distributedAt: null,
      });
      await qr.manager.save(impression);

      // 1. User share (pending balance)
      if (userShare > 0 && userWallet) {
        await this.financialTx.transferAtomic(qr, {
          sourceWalletId: SYSTEM_WALLET_IDS.AD_NETWORK,
          destWalletId: userWallet.id,
          amount: userShare,
          currency: 'USD',
          referenceId: impression.id,
          type: TransactionType.AD_REVENUE,
          target: 'pending',
          metadata: { side: 'user_share', adType: dto.ad_type },
        });
      } else if (userShare > 0) {
        this.logger.warn(
          `No wallet for user ${dto.user_id}; user share skipped.`,
        );
      }

      // 2. Developer share (pending balance)
      if (devShare > 0 && devWallet) {
        await this.financialTx.transferAtomic(qr, {
          sourceWalletId: SYSTEM_WALLET_IDS.AD_NETWORK,
          destWalletId: devWallet.id,
          amount: devShare,
          currency: 'USD',
          referenceId: impression.id,
          type: TransactionType.AD_REVENUE,
          target: 'pending',
          metadata: { side: 'dev_share', adType: dto.ad_type },
        });
      } else if (devShare > 0) {
        this.logger.warn(
          `No wallet for developer ${application.developerId}; dev share skipped.`,
        );
      }

      // 3. Platform fee → PLATFORM wallet (available balance)
      if (platformFee > 0) {
        await this.financialTx.transferAtomic(qr, {
          sourceWalletId: SYSTEM_WALLET_IDS.AD_NETWORK,
          destWalletId: SYSTEM_WALLET_IDS.PLATFORM,
          amount: platformFee,
          currency: 'USD',
          referenceId: impression.id,
          type: TransactionType.FEE,
          target: 'available',
          metadata: { side: 'platform_fee', adType: dto.ad_type },
        });
      }

      // 4. Mark impression distributed (commit-after pattern)
      impression.distributed = true;
      impression.distributedAt = new Date();
      await qr.manager.save(impression);

      // 5. Application stats
      application.totalEvents = Number(application.totalEvents) + 1;
      application.totalRevenue =
        Number(application.totalRevenue) + Number(grossRevenue);
      application.lastEventAt = new Date();
      await qr.manager.save(application);

      return impression;
    });

    // Async unique-user count update (best-effort, outside the tx).
    void this.refreshUniqueUserCount(appId).catch((err) =>
      this.logger.warn(
        `Unique user count refresh failed: ${(err as Error).message}`,
      ),
    );

    // Emit event for WebSocket / webhook bridges (Phase 4 / 3).
    this.eventEmitter.emit('wallet.credited', {
      impressionId: persisted.id,
      applicationId: appId,
      userId: dto.user_id,
      developerId: application.developerId,
      campaignId: persisted.campaignId,
      userShare: Number(persisted.userShare),
      devShare: Number(persisted.devShare),
      platformFee: Number(persisted.platformFee),
      grossRevenue: Number(persisted.grossRevenue),
      adType: dto.ad_type,
    });

    return this.toImpressionResponse(persisted);
  }

  /**
   * Public SDK path. Seals an impression against a previously-issued slot
   * token. The slot token carries: appId, userId, adType, server-resolved
   * adUnitId, and a unique nonce.
   *
   * Defence layers:
   *  1. HMAC signature verification (rejects tampered tokens)
   *  2. Expiry check (5 min default)
   *  3. In-memory nonce ledger (rejects intra-instance replays)
   *  4. DB unique partial index on `slot_nonce` (rejects cross-instance and
   *     post-restart replays)
   *  5. App-id binding (rejects token use against a different app)
   *  6. Server-resolved revenue (client-reported value is a hint only — see
   *     `AdMediationService.reconcileRevenue`)
   */
  async sealImpression(
    appId: string,
    dto: SealImpressionDto,
  ): Promise<ImpressionResponseDto> {
    const { payload, nonce } = this.mediation.verifySlot(appId, dto.slot_token);

    const application = await this.applicationRepository.findOne({
      where: { id: appId },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const existing = await this.impressionRepository.findOne({
      where: { slotNonce: nonce },
    });
    if (existing) {
      throw new ConflictException('Slot already sealed');
    }

    const { revenue: grossRevenue, suspicious } = this.mediation.reconcileRevenue(
      payload,
      dto,
    );

    const userSharePercent =
      application.userSharePercent > 0
        ? application.userSharePercent
        : DEFAULT_USER_SHARE_PERCENT;

    const userWallet = await this.walletRepository.findOne({
      where: { ownerId: payload.userId },
    });
    const devWallet = await this.walletRepository.findOne({
      where: { ownerId: application.developerId },
    });

    const persisted = await this.financialTx.runInTransaction(async (qr) => {
      const matched = await this.campaignMatcher.matchAndCharge(qr, {
        applicationId: appId,
        application,
        userId: payload.userId,
        qualityScore: payload.qualityScoreHint,
      });

      const finalGross = matched ? matched.bidAmount : grossRevenue;
      const { userShare, devShare, platformFee } = this.calculateRevenueSplit(
        finalGross,
        userSharePercent,
      );

      const impression = qr.manager.create(AdImpression, {
        applicationId: appId,
        userId: payload.userId,
        developerId: application.developerId,
        campaignId: matched?.campaignId ?? null,
        adType: payload.adType,
        adUnitId: payload.adUnitId,
        grossRevenue: finalGross,
        userShare,
        devShare,
        platformFee,
        sessionId: payload.sessionId,
        slotNonce: nonce,
        sealedAt: new Date(),
        revenueConfirmed: false,
        distributed: false,
        distributedAt: null,
      });
      await qr.manager.save(impression);

      if (userShare > 0 && userWallet) {
        await this.financialTx.transferAtomic(qr, {
          sourceWalletId: SYSTEM_WALLET_IDS.AD_NETWORK,
          destWalletId: userWallet.id,
          amount: userShare,
          currency: 'USD',
          referenceId: impression.id,
          type: TransactionType.AD_REVENUE,
          target: 'pending',
          metadata: { side: 'user_share', adType: payload.adType, suspicious },
        });
      } else if (userShare > 0) {
        this.logger.warn(
          `No wallet for user ${payload.userId}; user share skipped.`,
        );
      }

      if (devShare > 0 && devWallet) {
        await this.financialTx.transferAtomic(qr, {
          sourceWalletId: SYSTEM_WALLET_IDS.AD_NETWORK,
          destWalletId: devWallet.id,
          amount: devShare,
          currency: 'USD',
          referenceId: impression.id,
          type: TransactionType.AD_REVENUE,
          target: 'pending',
          metadata: { side: 'dev_share', adType: payload.adType, suspicious },
        });
      } else if (devShare > 0) {
        this.logger.warn(
          `No wallet for developer ${application.developerId}; dev share skipped.`,
        );
      }

      if (platformFee > 0) {
        await this.financialTx.transferAtomic(qr, {
          sourceWalletId: SYSTEM_WALLET_IDS.AD_NETWORK,
          destWalletId: SYSTEM_WALLET_IDS.PLATFORM,
          amount: platformFee,
          currency: 'USD',
          referenceId: impression.id,
          type: TransactionType.FEE,
          target: 'available',
          metadata: { side: 'platform_fee', adType: payload.adType },
        });
      }

      impression.distributed = true;
      impression.distributedAt = new Date();
      await qr.manager.save(impression);

      application.totalEvents = Number(application.totalEvents) + 1;
      application.totalRevenue =
        Number(application.totalRevenue) + Number(finalGross);
      application.lastEventAt = new Date();
      await qr.manager.save(application);

      return impression;
    });

    void this.refreshUniqueUserCount(appId).catch((err) =>
      this.logger.warn(
        `Unique user count refresh failed: ${(err as Error).message}`,
      ),
    );

    this.eventEmitter.emit('wallet.credited', {
      impressionId: persisted.id,
      applicationId: appId,
      userId: payload.userId,
      developerId: application.developerId,
      campaignId: persisted.campaignId,
      userShare: Number(persisted.userShare),
      devShare: Number(persisted.devShare),
      platformFee: Number(persisted.platformFee),
      grossRevenue: Number(persisted.grossRevenue),
      adType: payload.adType,
      suspicious,
    });

    return this.toImpressionResponse(persisted);
  }

  /**
   * Best-effort recompute of `application.totalUsers` after an impression
   * commit. Runs outside the tx to keep the hot path fast.
   */
  private async refreshUniqueUserCount(appId: string): Promise<void> {
    const result = await this.impressionRepository
      .createQueryBuilder('i')
      .select('COUNT(DISTINCT i.user_id)', 'count')
      .where('i.application_id = :appId', { appId })
      .getRawOne();
    const total = parseInt(result?.count ?? '0', 10);
    await this.applicationRepository.update(
      { id: appId },
      { totalUsers: total },
    );
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
      campaign_id: impression.campaignId ?? null,
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

  async getActiveCreative(): Promise<AdCreative | null> {
    return this.creativeRepository.findOne({ where: { isActive: true } });
  }

  async createCreative(dto: {
    brandName: string;
    imageUrl: string;
    ctaText?: string;
    buyerId?: string;
  }): Promise<AdCreative> {
    const creative = this.creativeRepository.create({
      brandName: dto.brandName,
      imageUrl: dto.imageUrl,
      ctaText: dto.ctaText ?? null,
      buyerId: dto.buyerId ?? null,
      isActive: false,
    });
    return this.creativeRepository.save(creative);
  }

  async activateCreative(id: string): Promise<AdCreative> {
    await this.dataSource.transaction(async (em) => {
      await em.update(AdCreative, { isActive: true }, { isActive: false });
      await em.update(AdCreative, { id }, { isActive: true });
    });
    const updated = await this.creativeRepository.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('AdCreative not found');
    return updated;
  }

  async getCreativesByBuyer(buyerId: string): Promise<AdCreative[]> {
    return this.creativeRepository.find({
      where: { buyerId },
      order: { createdAt: 'DESC' },
    });
  }

  async serveAd(tags: string[]): Promise<ServeAdResponseDto | null> {
    const creative = await this.creativeRepository.findOne({ where: { isActive: true } });
    if (!creative) return null;

    const campaigns = await this.campaignRepository.find({
      where: { status: CampaignStatus.ACTIVE },
      order: { bidPerImpression: 'DESC' },
    });

    for (const campaign of campaigns) {
      const targeting = campaign.targeting as CampaignTargeting;
      const contentTags: string[] = targeting?.contentTags ?? [];

      if (contentTags.length === 0) {
        return {
          campaign_id: campaign.id,
          brand_name: creative.brandName,
          headline: creative.ctaText ?? `${creative.brandName} — Özel Teklif`,
          sub_copy: "nike.com.tr'de şimdi keşfet",
          cta_label: 'Şimdi Keşfet →',
          image_url: creative.imageUrl ?? null,
          matched_tags: tags.slice(0, 3),
        };
      }

      const overlap = tags.filter((t) => contentTags.includes(t.toLowerCase()));
      if (overlap.length > 0) {
        return {
          campaign_id: campaign.id,
          brand_name: creative.brandName,
          headline: creative.ctaText ?? `${creative.brandName} — Özel Teklif`,
          sub_copy: "nike.com.tr'de şimdi keşfet",
          cta_label: 'Şimdi Keşfet →',
          image_url: creative.imageUrl ?? null,
          matched_tags: overlap,
        };
      }
    }

    return null;
  }
}
