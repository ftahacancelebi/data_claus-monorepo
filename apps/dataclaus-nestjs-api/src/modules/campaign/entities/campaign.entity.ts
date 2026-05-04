import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  CampaignStatus,
  CampaignTargeting,
} from '../../../common/constants';

@Entity('campaigns')
export class Campaign extends BaseEntity {
  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'total_budget', type: 'decimal', precision: 18, scale: 8 })
  totalBudget: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  remaining: number;

  @Column({
    name: 'spent_budget',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  spentBudget: number;

  @Column({
    name: 'bid_per_impression',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  bidPerImpression: number;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  targeting: CampaignTargeting;

  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.ACTIVE,
  })
  status: CampaignStatus;

  @Column({ name: 'starts_at', type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'impressions_served', type: 'int', default: 0 })
  impressionsServed: number;

  @Column({ name: 'unique_users_reached', type: 'int', default: 0 })
  uniqueUsersReached: number;
}
