import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { Wallet } from '../wallet/entities';
import { LedgerTransaction } from './entities/ledger-transaction.entity';
import {
  TransactionStatus,
  TransactionType,
  SYSTEM_WALLET_IDS,
} from '../../common/constants';

export type CreditTarget = 'pending' | 'available';

export interface TransferArgs {
  sourceWalletId: string;
  destWalletId: string;
  amount: number;
  currency?: string;
  referenceId?: string | null;
  type?: TransactionType;
  /** Whether the destination credit should land in `balance` or `pendingBalance`. Default: pending. */
  target?: CreditTarget;
  /** Lock the source wallet for write to prevent overdraft on concurrency. Default: true. */
  lockSource?: boolean;
  /** Free-form metadata. */
  metadata?: Record<string, unknown> | null;
}

export interface CreditPendingArgs {
  destWalletId: string;
  amount: number;
  currency?: string;
  referenceId?: string | null;
  type?: TransactionType;
  metadata?: Record<string, unknown> | null;
}

/**
 * Atomic transaction helper used by ingest, ads and payout services.
 *
 * `runInTransaction(cb)` opens a TypeORM QueryRunner, hands it to the
 * callback, commits on success and rolls back on any error. Code that
 * touches wallet balances + ledger MUST go through this helper to keep
 * double-entry invariants safe.
 *
 * `transferAtomic` is the canonical primitive: it writes two ledger
 * rows (a paired credit + debit) such that
 *   SUM(amount) WHERE status='completed' === 0
 * holds across the whole table.
 *
 * `creditPendingBalance` is a thin wrapper that defaults the source to
 * the AD_NETWORK system wallet and the target to pending balance.
 */
@Injectable()
export class FinancialTxService {
  private readonly logger = new Logger(FinancialTxService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async runInTransaction<T>(
    work: (qr: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const result = await work(qr);
      await qr.commitTransaction();
      return result;
    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(
        `Transaction rolled back: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * Atomic transfer between two wallets writing paired double-entry rows.
   *
   * Call ONLY from inside `runInTransaction`.
   * Returns the credit row id (paired transactions can be looked up via
   * `pairedTransactionId`).
   */
  async transferAtomic(
    qr: QueryRunner,
    args: TransferArgs,
  ): Promise<{ creditId: string; debitId: string }> {
    if (!(args.amount > 0)) {
      throw new Error('transferAtomic: amount must be positive');
    }
    if (args.sourceWalletId === args.destWalletId) {
      throw new Error('transferAtomic: source and dest must differ');
    }

    const manager = qr.manager;
    const target: CreditTarget = args.target ?? 'pending';
    const currency = args.currency ?? 'USD';

    // Pessimistic lock on source wallet (prevents concurrent overdraft).
    if (args.lockSource !== false) {
      const source = await manager.findOne(Wallet, {
        where: { id: args.sourceWalletId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!source) {
        throw new Error(`Source wallet not found: ${args.sourceWalletId}`);
      }
      if (Number(source.balance) < args.amount) {
        throw new Error(
          `Insufficient balance on source wallet ${args.sourceWalletId}`,
        );
      }
    }

    // Decrement source.balance
    const decremented = await manager
      .createQueryBuilder()
      .update(Wallet)
      .set({
        balance: () =>
          `COALESCE(balance, 0) - ${this.toSqlNumber(args.amount)}`,
      })
      .where('id = :id', { id: args.sourceWalletId })
      .execute();
    if (!decremented.affected) {
      throw new Error(`Source wallet missing: ${args.sourceWalletId}`);
    }

    // Increment dest balance (pending or available)
    const destField =
      target === 'available' ? 'balance' : 'pending_balance';
    const credited = await manager
      .createQueryBuilder()
      .update(Wallet)
      .set({
        ...(target === 'available'
          ? {
              balance: () =>
                `COALESCE(balance, 0) + ${this.toSqlNumber(args.amount)}`,
            }
          : {
              pendingBalance: () =>
                `COALESCE(${destField}, 0) + ${this.toSqlNumber(args.amount)}`,
            }),
      })
      .where('id = :id', { id: args.destWalletId })
      .execute();
    if (!credited.affected) {
      throw new Error(`Destination wallet missing: ${args.destWalletId}`);
    }

    // Paired ledger rows
    const debitTx = manager.create(LedgerTransaction, {
      sourceWalletId: args.sourceWalletId,
      destWalletId: args.destWalletId,
      amount: -Math.abs(args.amount),
      currency,
      referenceId: args.referenceId ?? null,
      type: args.type ?? TransactionType.AD_REVENUE,
      status: TransactionStatus.COMPLETED,
      metadata: { side: 'debit', ...(args.metadata ?? {}) },
    });
    const debitSaved = await manager.save(debitTx);

    const creditTx = manager.create(LedgerTransaction, {
      sourceWalletId: args.sourceWalletId,
      destWalletId: args.destWalletId,
      amount: Math.abs(args.amount),
      currency,
      referenceId: args.referenceId ?? null,
      type: args.type ?? TransactionType.AD_REVENUE,
      status: TransactionStatus.COMPLETED,
      pairedTransactionId: debitSaved.id,
      metadata: { side: 'credit', target, ...(args.metadata ?? {}) },
    });
    const creditSaved = await manager.save(creditTx);

    // Backfill the debit's paired pointer (so both sides reference each
    // other; useful for dashboards walking the chain in either direction).
    await manager.update(
      LedgerTransaction,
      { id: debitSaved.id },
      { pairedTransactionId: creditSaved.id },
    );

    return { creditId: creditSaved.id, debitId: debitSaved.id };
  }

  /**
   * Convenience: credit `pendingBalance` of `destWalletId` from the
   * AD_NETWORK system wallet (capstone default source for ad/event
   * payouts).
   */
  async creditPendingBalance(
    qr: QueryRunner,
    args: CreditPendingArgs,
  ): Promise<LedgerTransaction> {
    const sourceWalletId = await this.resolvePlatformWalletId(qr.manager);
    const { creditId } = await this.transferAtomic(qr, {
      sourceWalletId,
      destWalletId: args.destWalletId,
      amount: args.amount,
      currency: args.currency,
      referenceId: args.referenceId,
      type: args.type ?? TransactionType.AD_REVENUE,
      target: 'pending',
      metadata: args.metadata,
    });
    const tx = await qr.manager.findOne(LedgerTransaction, {
      where: { id: creditId },
    });
    if (!tx) throw new Error('credit row vanished after transfer');
    return tx;
  }

  private toSqlNumber(value: number): string {
    if (!Number.isFinite(value)) {
      throw new Error('Invalid numeric value for SQL: ' + value);
    }
    return Number(value).toFixed(8);
  }

  /**
   * Resolves the AD_NETWORK system wallet — the source of all ad/event
   * payouts in capstone scope. Seeded by ensureSystemWallets at boot
   * (see src/database/seeds/system-wallet.seed.ts).
   */
  private async resolvePlatformWalletId(
    _manager: EntityManager,
  ): Promise<string> {
    return SYSTEM_WALLET_IDS.AD_NETWORK;
  }
}
