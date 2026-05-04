import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * A developer-registered HTTPS endpoint that receives signed event POSTs.
 *
 * One developer may have multiple endpoints (e.g., staging + prod).
 * Each endpoint subscribes to one or more event types via the
 * `event_types` JSONB array (e.g., `["wallet.credited"]`).
 */
@Entity('webhook_endpoints')
@Index('idx_webhook_endpoints_developer', ['developerId'])
export class WebhookEndpoint extends BaseEntity {
  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  @Column({ type: 'varchar', length: 1000 })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  /**
   * Subscribed event names. Empty array = subscribe to all events.
   * Stored as JSONB so we can extend with regex/wildcards later without
   * a migration.
   */
  @Column({ name: 'event_types', type: 'jsonb', default: () => "'[]'::jsonb" })
  eventTypes: string[];

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'failure_count', type: 'int', default: 0 })
  failureCount: number;

  @Column({ name: 'disabled_at', type: 'timestamp', nullable: true })
  disabledAt: Date | null;
}
