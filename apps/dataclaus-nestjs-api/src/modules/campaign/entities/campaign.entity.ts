import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CampaignStatus } from '../../../common/constants';

@Entity('campaigns')
export class Campaign extends BaseEntity {
  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'total_budget', type: 'decimal', precision: 18, scale: 8 })
  totalBudget: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  remaining: number;

  @Column({
    type: 'enum',
    enum: CampaignStatus,
    default: CampaignStatus.ACTIVE,
  })
  status: CampaignStatus;
}
