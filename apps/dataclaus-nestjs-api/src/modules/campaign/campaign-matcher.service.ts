import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Application } from '../application/entities/application.entity';
import {
  CampaignStatus,
  CampaignTargeting,
  SYSTEM_WALLET_IDS,
  TransactionType,
  WalletType,
} from '../../common/constants';
import { FinancialTxService } from '../ledger/financial-tx.service';

export interface MatchContext {
  applicationId: string;
  application: Application;
  userId: string;
  qualityScore: number;
}

export interface MatchResult {
  campaignId: string;
  bidAmount: number;
}

@Injectable()
export class CampaignMatcherService {
  private readonly logger = new Logger(CampaignMatcherService.name);

  constructor(private readonly financialTx: FinancialTxService) {}

  /**
   * Find an eligible campaign for the impression and atomically charge the
   * buyer wallet (bidPerImpression) → AD_NETWORK.
   *
   * Must be called inside an open `runInTransaction` callback. Returns the
   * matched campaign + bid amount, or `null` if no campaign matches (caller
   * falls back to default eCPM).
   *
   * Atomicity: this writes to the same QueryRunner as the parent ad
   * impression transaction, so a downstream failure rolls everything back.
   */
  async matchAndCharge(
    qr: QueryRunner,
    ctx: MatchContext,
  ): Promise<MatchResult | null> {
    const now = new Date();

    const candidates = await qr.manager
      .createQueryBuilder(Campaign, 'c')
      .where('c.status = :status', { status: CampaignStatus.ACTIVE })
      .orderBy('c.bidPerImpression', 'DESC')
      .addOrderBy('c.createdAt', 'ASC')
      .getMany();

    for (const campaign of candidates) {
      const bid = Number(campaign.bidPerImpression);
      if (!(bid > 0)) continue;

      const remaining = Number(campaign.remaining);
      if (remaining < bid) {
        // Out of budget: mark completed (best-effort; may already be).
        if (campaign.status === CampaignStatus.ACTIVE) {
          campaign.status = CampaignStatus.COMPLETED;
          await qr.manager.save(campaign);
        }
        continue;
      }

      if (!this.matchesSchedule(campaign, now)) continue;
      if (!this.matchesTargeting(campaign.targeting, ctx)) continue;

      // Find buyer wallet (BUYER type owned by buyerId).
      const buyerWallet = await qr.manager.findOne(Wallet, {
        where: { ownerId: campaign.buyerId, type: WalletType.BUYER },
      });
      if (!buyerWallet) {
        this.logger.warn(
          `Buyer ${campaign.buyerId} has no BUYER wallet; skipping campaign ${campaign.id}`,
        );
        continue;
      }
      if (Number(buyerWallet.balance) < bid) {
        // Wallet out of funds: pause the campaign so we don't keep retrying.
        campaign.status = CampaignStatus.PAUSED;
        await qr.manager.save(campaign);
        this.logger.warn(
          `Buyer wallet ${buyerWallet.id} insufficient (${buyerWallet.balance} < ${bid}); paused campaign ${campaign.id}`,
        );
        continue;
      }

      try {
        await this.financialTx.transferAtomic(qr, {
          sourceWalletId: buyerWallet.id,
          destWalletId: SYSTEM_WALLET_IDS.AD_NETWORK,
          amount: bid,
          currency: 'USD',
          referenceId: campaign.id,
          type: TransactionType.AD_SPEND,
          target: 'available',
          metadata: {
            side: 'campaign_bid',
            campaignId: campaign.id,
            applicationId: ctx.applicationId,
            userId: ctx.userId,
          },
        });
      } catch (err) {
        this.logger.warn(
          `Bid transfer failed for campaign ${campaign.id}: ${(err as Error).message}`,
        );
        continue;
      }

      // Update counters (we hold the row implicitly via re-save; no SELECT FOR UPDATE
      // needed because the transferAtomic above already locked the source wallet).
      campaign.spentBudget = Number(campaign.spentBudget) + bid;
      campaign.remaining = Number(campaign.remaining) - bid;
      campaign.impressionsServed = Number(campaign.impressionsServed) + 1;
      if (campaign.remaining < bid) {
        campaign.status = CampaignStatus.COMPLETED;
      }
      await qr.manager.save(campaign);

      return { campaignId: campaign.id, bidAmount: bid };
    }

    return null;
  }

  private matchesSchedule(campaign: Campaign, now: Date): boolean {
    if (campaign.startsAt && now < new Date(campaign.startsAt)) return false;
    if (campaign.endsAt && now > new Date(campaign.endsAt)) return false;
    return true;
  }

  private matchesTargeting(
    targeting: CampaignTargeting | null | undefined,
    ctx: MatchContext,
  ): boolean {
    if (!targeting) return true;

    if (
      typeof targeting.minQualityScore === 'number' &&
      ctx.qualityScore < targeting.minQualityScore
    ) {
      return false;
    }

    if (targeting.appCategories?.length) {
      const cat = ctx.application?.category;
      if (!cat || !targeting.appCategories.includes(cat)) return false;
    }

    // countries / deviceTypes: not enforced in capstone scope (no impression
    // metadata for them yet). Left as future work.
    return true;
  }
}
