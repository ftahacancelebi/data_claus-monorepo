import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export type AuditActorType =
  | 'admin'
  | 'developer'
  | 'user'
  | 'buyer'
  | 'system'
  | 'anonymous';

/**
 * Append-only audit log of security-sensitive actions.
 *
 * Populated automatically by AuditInterceptor for routes decorated with
 * `@AuditAction(...)`. The `context` JSONB column accepts any structured
 * payload — keep it scoped (no full-body dumps that may contain PII).
 */
@Entity('audit_log')
@Index('idx_audit_actor', ['actorType', 'actorId'])
@Index('idx_audit_action', ['action', 'createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ name: 'actor_type', type: 'varchar', length: 16 })
  actorType: AuditActorType;

  @Column({ name: 'actor_id', type: 'varchar', length: 64 })
  actorId: string;

  /** Dotted path: e.g. `developer.api_key.rotated`, `payout.requested`. */
  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'target_type', type: 'varchar', length: 32, nullable: true })
  targetType: string | null;

  @Column({ name: 'target_id', type: 'varchar', length: 64, nullable: true })
  targetId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  context: Record<string, unknown>;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'int', nullable: true })
  status: number | null;

  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true })
  errorMessage: string | null;
}
