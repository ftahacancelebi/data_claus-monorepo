import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchEvent } from '../watch-events/entities/watch-event.entity';
import { Wallet } from '../wallet/entities';
import { FinancialTxService } from '../ledger/financial-tx.service';
import { SYSTEM_WALLET_IDS, TransactionType } from '../../common/constants';

interface PackagePurchasedEvent {
  packageId: string;
  applicationId: string | null;
  category: string;
  contributorCut: number;
}

const MIN_DISTRIBUTION = 0.0001; // Skip shares below $0.0001 to avoid ledger noise
const MAX_CONTRIBUTORS = 1000;   // Cap to avoid huge transactions on popular packages

@Injectable()
export class ContributorDistributionService {
  private readonly logger = new Logger(ContributorDistributionService.name);

  constructor(
    @InjectRepository(WatchEvent)
    private readonly watchRepo: Repository<WatchEvent>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    private readonly financialTx: FinancialTxService,
  ) {}

  @OnEvent('package.purchased')
  async onPurchased(event: PackagePurchasedEvent): Promise<void> {
    const { packageId, applicationId, category, contributorCut } = event;

    if (!applicationId || contributorCut <= 0) return;

    // Find users who contributed matching watch data, proportional to event count
    const rows = await this.watchRepo
      .createQueryBuilder('we')
      .select('we.userId', 'userId')
      .addSelect('COUNT(*)', 'eventCount')
      .where('we.applicationId = :appId', { appId: applicationId })
      .andWhere('we.videoCategory = :cat', { cat: category })
      .groupBy('we.userId')
      .orderBy('eventCount', 'DESC')
      .limit(MAX_CONTRIBUTORS)
      .getRawMany<{ userId: string; eventCount: string }>();

    if (rows.length === 0) {
      this.logger.debug(
        `No contributors for package ${packageId} (app=${applicationId}, cat=${category})`,
      );
      return;
    }

    const totalEvents = rows.reduce((sum, r) => sum + parseInt(r.eventCount, 10), 0);

    try {
      await this.financialTx.runInTransaction(async (qr) => {
        for (const row of rows) {
          const share = (parseInt(row.eventCount, 10) / totalEvents) * contributorCut;
          if (share < MIN_DISTRIBUTION) continue;

          const wallet = await this.walletRepo.findOne({
            where: { ownerId: row.userId },
          });
          if (!wallet) continue;

          await this.financialTx.transferAtomic(qr, {
            sourceWalletId: SYSTEM_WALLET_IDS.DATA_CONTRIBUTORS,
            destWalletId: wallet.id,
            amount: parseFloat(share.toFixed(6)),
            currency: 'USD',
            referenceId: packageId,
            type: TransactionType.DATA_REVENUE,
            target: 'pending',
            metadata: {
              source: 'data_sale',
              package_id: packageId,
              application_id: applicationId,
              category,
              event_count: row.eventCount,
              total_events: totalEvents,
            },
          });
        }
      });

      this.logger.log(
        `Distributed $${contributorCut.toFixed(4)} contributor pool across ${rows.length} users for package ${packageId}`,
      );
    } catch (err) {
      // Best-effort — purchase already committed; log and continue
      this.logger.warn(
        `Contributor distribution failed for package ${packageId}: ${(err as Error).message}`,
      );
    }
  }
}
