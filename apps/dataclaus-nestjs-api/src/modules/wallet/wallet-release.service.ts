import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { FinancialTxService } from '../ledger/financial-tx.service';
import {
  MIN_PAYOUT_THRESHOLD,
  SYSTEM_WALLET_IDS,
  TransactionType,
  WalletType,
} from '../../common/constants';

export interface ReleaseRunResult {
  scanned: number;
  released: number;
  totalReleased: number;
  ranAt: string;
}

/**
 * Periodic releaser that moves pending balance into available balance for
 * USER and DEVELOPER wallets once the threshold is met. Runs every hour
 * in capstone mode (threshold = $0.01) so demo users see their pending
 * balance flow into withdrawable balance reasonably quickly without
 * losing the "pending → available" stage altogether.
 *
 * Each release is recorded as a paired ledger transfer
 * (PLATFORM ↔ wallet, type=PENDING_RELEASE) so the double-entry
 * invariant remains valid.
 */
@Injectable()
export class WalletReleaseService {
  private readonly logger = new Logger(WalletReleaseService.name);
  private lastRun: ReleaseRunResult | null = null;

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly financialTx: FinancialTxService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'wallet-release-pending' })
  async runScheduled(): Promise<ReleaseRunResult> {
    return this.releaseAllEligible();
  }

  async releaseAllEligible(): Promise<ReleaseRunResult> {
    const wallets = await this.walletRepository
      .createQueryBuilder('w')
      .where('w.type IN (:...types)', {
        types: [WalletType.USER, WalletType.DEVELOPER],
      })
      .andWhere('w.pending_balance >= :threshold', {
        threshold: MIN_PAYOUT_THRESHOLD,
      })
      .getMany();

    let released = 0;
    let totalReleased = 0;

    for (const wallet of wallets) {
      const amount = Number(wallet.pendingBalance);
      if (amount < MIN_PAYOUT_THRESHOLD) continue;

      try {
        await this.releaseSingle(wallet);
        released += 1;
        totalReleased += amount;
      } catch (err) {
        this.logger.warn(
          `Pending release for wallet ${wallet.id} failed: ${(err as Error).message}`,
        );
      }
    }

    const result: ReleaseRunResult = {
      scanned: wallets.length,
      released,
      totalReleased,
      ranAt: new Date().toISOString(),
    };
    this.lastRun = result;
    if (released > 0) {
      this.logger.log(
        `Released pending balance for ${released}/${wallets.length} wallets ($${totalReleased.toFixed(8)} total)`,
      );
    }
    return result;
  }

  /**
   * Release pending balance for a single wallet (used by the wallet
   * release endpoint in the dashboard). Idempotent: returns 0 when
   * pending balance is below threshold.
   */
  async releaseForWalletId(walletId: string): Promise<number> {
    const wallet = await this.walletRepository.findOne({
      where: { id: walletId },
    });
    if (!wallet) {
      throw new Error(`Wallet not found: ${walletId}`);
    }
    const amount = Number(wallet.pendingBalance);
    if (amount < MIN_PAYOUT_THRESHOLD) return 0;
    await this.releaseSingle(wallet);
    return amount;
  }

  private async releaseSingle(wallet: Wallet): Promise<void> {
    const amount = Number(wallet.pendingBalance);
    await this.financialTx.runInTransaction(async (qr) => {
      // Subtract from pending
      await qr.manager
        .createQueryBuilder()
        .update(Wallet)
        .set({
          pendingBalance: () =>
            `COALESCE(pending_balance, 0) - ${amount.toFixed(8)}`,
        })
        .where('id = :id', { id: wallet.id })
        .execute();

      // Atomic transfer from PLATFORM treasury → wallet (available)
      // produces the paired credit/debit ledger rows that keep the
      // invariant intact.
      await this.financialTx.transferAtomic(qr, {
        sourceWalletId: SYSTEM_WALLET_IDS.PLATFORM,
        destWalletId: wallet.id,
        amount,
        currency: wallet.currency,
        referenceId: wallet.id,
        type: TransactionType.PENDING_RELEASE,
        target: 'available',
        metadata: {
          stage: 'pending_release',
          walletType: wallet.type,
        },
      });
    });
  }

  getLastRun(): ReleaseRunResult | null {
    return this.lastRun;
  }
}
