import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { WalletType, MIN_PAYOUT_THRESHOLD } from '../../../common/constants';

@Entity('wallets')
export class Wallet extends BaseEntity {
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ type: 'enum', enum: WalletType, default: WalletType.USER })
  type: WalletType;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  balance: number;

  @Column({
    name: 'pending_balance',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  pendingBalance: number;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  shouldReleasePending(): boolean {
    return this.pendingBalance >= MIN_PAYOUT_THRESHOLD;
  }

  releasePending(): number {
    const pendingAmount = Number(this.pendingBalance);
    if (pendingAmount >= MIN_PAYOUT_THRESHOLD) {
      this.balance = Number(this.balance) + pendingAmount;
      this.pendingBalance = 0;
      return pendingAmount;
    }
    return 0;
  }
}
