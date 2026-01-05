import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Developer } from '../../developer/entities/developer.entity';

@Entity('applications')
export class Application extends BaseEntity {
  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string;

  @Column({ name: 'website_url', type: 'varchar', length: 500, nullable: true })
  websiteUrl: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Statistics (updated by AI Worker)
  @Column({ name: 'total_events', type: 'bigint', default: 0 })
  totalEvents: number;

  @Column({ name: 'total_users', type: 'bigint', default: 0 })
  totalUsers: number;

  @Column({
    name: 'total_revenue',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  totalRevenue: number;

  @Column({
    name: 'quality_score',
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
  })
  qualityScore: number;

  @Column({ name: 'last_event_at', type: 'timestamp', nullable: true })
  lastEventAt: Date | null;

  // Revenue settings
  @Column({ name: 'user_share_percent', type: 'int', default: 0 })
  userSharePercent: number;

  @ManyToOne(() => Developer, (developer) => developer.applications)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
