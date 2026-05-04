import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * One-time password request for end-user email-based authentication.
 *
 * Lifecycle:
 *   1. requestOtp → row inserted (codeHash, expiresAt, attempts=0).
 *   2. verifyOtp  → bcrypt.compare on codeHash; attempts++ on each try.
 *   3. usedAt set on success → row consumed, no longer returned by findValid.
 *
 * Brute-force protection: hard cap of 5 attempts per row. Repeated requests
 * for the same email invalidate prior unused rows (handled in service).
 */
@Entity('otp_requests')
@Index('idx_otp_email_created', ['email', 'createdAt'])
export class OtpRequest extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;
}
