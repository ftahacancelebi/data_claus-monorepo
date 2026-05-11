import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * One row per buyer purchase of a DataPackage.
 *
 * `buyerId` is intentionally NOT a hard FK — it references `dataclaus_users.id`
 * for normal buyers (the auth flow already provisions them) but a developer
 * or admin could also be on the buying side during demos. Keep it as a plain
 * uuid column with an index; ownership checks happen at the service layer.
 *
 * `ledgerTransactionId` points at the buyer→developer credit row produced by
 * FinancialTxService.transferAtomic. The matched paired debit + the 5%
 * platform-fee transfer are reachable via `LedgerTransaction.pairedTransactionId`
 * and the shared `referenceId = package_id`.
 */
@Entity('package_purchases')
@Index('idx_purchases_buyer', ['buyerId', 'purchasedAt'])
@Index('idx_purchases_package', ['packageId'])
export class PackagePurchase extends BaseEntity {
  @Column({ name: 'package_id', type: 'uuid' })
  packageId: string;

  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    name: 'ledger_transaction_id',
    type: 'uuid',
    nullable: true,
  })
  ledgerTransactionId: string | null;

  /** One-shot token used by GET /v1/packages/:id/download. URL-safe. */
  @Column({
    name: 'download_token',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  downloadToken: string | null;

  @Column({ name: 'purchased_at', type: 'timestamp', default: () => 'NOW()' })
  purchasedAt: Date;
}
