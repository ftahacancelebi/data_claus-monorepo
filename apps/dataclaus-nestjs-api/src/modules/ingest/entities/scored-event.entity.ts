import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export type ScoredEventStatus = 'scored' | 'rejected';

@Entity('scored_events')
@Index('idx_scored_events_user', ['userId', 'ingestedAt'])
@Index('idx_scored_events_app', ['applicationId', 'ingestedAt'])
export class ScoredEvent extends BaseEntity {
  @Column({ name: 'event_id', type: 'varchar', length: 64, unique: true })
  eventId: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  @Column({ name: 'session_id', type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 32 })
  eventType: string;

  @Column({ name: 'fraud_score', type: 'decimal', precision: 5, scale: 4 })
  fraudScore: number;

  @Column({ name: 'quality_score', type: 'decimal', precision: 5, scale: 4 })
  qualityScore: number;

  @Column({
    name: 'payout_amount',
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
  })
  payoutAmount: number;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 16 })
  status: ScoredEventStatus;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  rejectionReason: string | null;

  @Column({ name: 'ingested_at', type: 'timestamp' })
  ingestedAt: Date;

  @Column({ name: 'scored_at', type: 'timestamp', nullable: true })
  scoredAt: Date | null;
}
