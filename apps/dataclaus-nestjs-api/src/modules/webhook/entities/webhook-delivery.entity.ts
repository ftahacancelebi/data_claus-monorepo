import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export type WebhookDeliveryStatus =
  | 'pending'
  | 'in_flight'
  | 'sent'
  | 'failed'
  | 'dead_letter';

/**
 * One row per outgoing webhook delivery attempt cohort.
 *
 * Outbox pattern: when an event fires, the dispatcher inserts a `pending`
 * row first (in the same transaction is ideal but not required for capstone).
 * A scheduled job picks up pending rows and POSTs to the endpoint URL,
 * updating status / attempts / next_attempt_at on each try.
 *
 * Retries: 3 attempts with exponential backoff (1s, 5s, 25s). After the
 * third failure the row transitions to `dead_letter` and stays there for
 * developer dashboard inspection.
 */
@Entity('webhook_deliveries')
@Index('idx_webhook_deliveries_status_next', ['status', 'nextAttemptAt'])
@Index('idx_webhook_deliveries_endpoint', ['endpointId'])
export class WebhookDelivery extends BaseEntity {
  @Column({ name: 'endpoint_id', type: 'uuid' })
  endpointId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType: string;

  /** Application-level event id, used for idempotency on the receiver side. */
  @Column({ name: 'event_id', type: 'varchar', length: 64 })
  eventId: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'pending',
  })
  status: WebhookDeliveryStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamp', nullable: true })
  nextAttemptAt: Date | null;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  lastAttemptAt: Date | null;

  @Column({
    name: 'last_response_status',
    type: 'int',
    nullable: true,
  })
  lastResponseStatus: number | null;

  @Column({
    name: 'last_response_body',
    type: 'text',
    nullable: true,
  })
  lastResponseBody: string | null;

  @Column({
    name: 'last_error',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  lastError: string | null;
}
