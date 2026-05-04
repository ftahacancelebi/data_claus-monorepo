import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PayoutMethod, PayoutStatus } from '../../../common/constants';

@Entity('payout_requests')
@Index('idx_payout_user_status', ['userId', 'status'])
@Index('idx_payout_status_requested_at', ['status', 'requestedAt'])
export class PayoutRequest extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'enum', enum: PayoutMethod })
  method: PayoutMethod;

  @Column({
    type: 'enum',
    enum: PayoutStatus,
    default: PayoutStatus.REQUESTED,
  })
  status: PayoutStatus;

  @Column({ name: 'requested_at', type: 'timestamp', default: () => 'now()' })
  requestedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 256,
    nullable: true,
  })
  rejectionReason: string | null;

  @Column({
    name: 'processed_by_admin_id',
    type: 'uuid',
    nullable: true,
  })
  processedByAdminId: string | null;

  /**
   * Pointer to the WITHDRAWAL ledger transaction created when the request
   * was opened. Used for traceability and to mirror the reversal entry on
   * rejection.
   */
  @Column({ name: 'hold_ledger_id', type: 'uuid', nullable: true })
  holdLedgerId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
