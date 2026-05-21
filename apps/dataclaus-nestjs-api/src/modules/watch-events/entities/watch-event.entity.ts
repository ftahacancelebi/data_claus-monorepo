import { Entity, Column, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('watch_events')
@Index('idx_watch_app_recorded', ['applicationId', 'recordedAt'])
@Index('idx_watch_user_recorded', ['userId', 'recordedAt'])
export class WatchEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'video_id', type: 'text' })
  videoId: string;

  @Column({ name: 'video_tags', type: 'text', array: true, default: '{}' })
  videoTags: string[];

  @Column({ name: 'video_category', type: 'varchar', length: 50, nullable: true })
  videoCategory: string | null;

  @Column({ name: 'dwell_ms', type: 'int' })
  dwellMs: number;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt: Date;
}
