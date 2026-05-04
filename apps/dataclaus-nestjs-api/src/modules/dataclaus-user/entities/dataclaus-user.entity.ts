import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('dataclaus_users')
export class DataClausUser extends BaseEntity {
  // Authentication
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
  })
  passwordHash: string;

  // Profile
  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  displayName: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  // Financial
  @Column({ name: 'wallet_id', type: 'uuid', nullable: true })
  walletId: string | null;

  // Quality & Earnings
  @Column({
    name: 'quality_score',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0.5,
  })
  qualityScore: number;

  @Column({
    name: 'total_earned',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalEarned: number;

  @Column({
    name: 'pending_balance',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  pendingBalance: number;

  // Metadata
  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'last_active_at', type: 'timestamp', nullable: true })
  lastActiveAt: Date | null;

  // KVKK/GDPR: cooling-off scheduled deletion. When set, the account
  // continues to function (user can cancel) until `delete_after`, after
  // which a scheduled job hard-deletes the row. See DsarService.
  @Column({ name: 'deletion_requested_at', type: 'timestamp', nullable: true })
  deletionRequestedAt: Date | null;

  @Column({ name: 'delete_after', type: 'timestamp', nullable: true })
  deleteAfter: Date | null;
}
