import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TransactionType, TransactionStatus } from '../../../common/constants';

@Entity('ledger_transactions')
@Index('idx_ledger_paired', ['pairedTransactionId'])
@Index('idx_ledger_reference', ['referenceId'])
export class LedgerTransaction extends BaseEntity {
  @Column({ name: 'source_wallet_id', type: 'uuid' })
  sourceWalletId: string;

  @Column({ name: 'dest_wallet_id', type: 'uuid' })
  destWalletId: string;

  /**
   * Signed amount.
   * - Positive value: credit row (dest gained funds)
   * - Negative value: paired debit row (source lost funds)
   *
   * Across the whole table, SUM(amount) WHERE status='completed' must
   * always equal 0 (double-entry invariant).
   */
  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  /**
   * Pointer to the paired half of a double-entry transfer.
   * For a credit row, points to the matching debit; for a debit row,
   * points to the matching credit. Null for legacy single-row entries.
   */
  @Column({
    name: 'paired_transaction_id',
    type: 'uuid',
    nullable: true,
  })
  pairedTransactionId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
