import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TransactionType, TransactionStatus } from '../../../common/constants';

@Entity('ledger_transactions')
export class LedgerTransaction extends BaseEntity {
  @Column({ name: 'source_wallet_id', type: 'uuid' })
  sourceWalletId: string;

  @Column({ name: 'dest_wallet_id', type: 'uuid' })
  destWalletId: string;

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
}
