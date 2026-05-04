import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * Signing secret bound to a webhook endpoint.
 *
 * Storage policy: `secretHash` (sha256 of value) is persisted; the cleartext
 * is only available at creation time, returned to the developer once. The
 * `secretPrefix` (first 8 chars, e.g. `whsec_a1`) is shown in dashboards
 * for identification without ever exposing the full secret.
 *
 * Multiple active secrets per endpoint are supported during rotation: any
 * active secret can sign outgoing payloads (we always sign with the newest)
 * but any active secret can verify (Stripe-pattern overlap window).
 */
@Entity('webhook_secrets')
@Index('idx_webhook_secrets_endpoint', ['endpointId'])
export class WebhookSecret extends BaseEntity {
  @Column({ name: 'endpoint_id', type: 'uuid' })
  endpointId: string;

  /** First 8 chars of the cleartext secret, safe for display. */
  @Column({ name: 'secret_prefix', type: 'varchar', length: 16 })
  secretPrefix: string;

  /** SHA-256 hash of the cleartext secret. */
  @Column({ name: 'secret_hash', type: 'varchar', length: 128 })
  secretHash: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  label: string | null;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;
}
