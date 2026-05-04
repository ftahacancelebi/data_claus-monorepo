import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Developer } from './developer.entity';

@Entity('api_keys')
export class ApiKey extends BaseEntity {
  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  @Column({ name: 'application_id', type: 'uuid', nullable: true })
  applicationId: string | null;

  @Column({ name: 'key_hash', type: 'varchar', length: 255 })
  keyHash: string;

  @Column({ name: 'key_prefix', type: 'varchar', length: 16 })
  keyPrefix: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  /**
   * When set, the key stops being accepted after this timestamp.
   * Set during rotation to give callers a 7-day overlap window.
   */
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  /**
   * Points to the key that supersedes this one (set on the OLD key when
   * rotation occurs). Lets the dashboard show "rotated → keyId".
   */
  @Column({ name: 'rotated_to_id', type: 'uuid', nullable: true })
  rotatedToId: string | null;

  @ManyToOne(() => Developer, (developer) => developer.apiKeys)
  @JoinColumn({ name: 'developer_id' })
  developer: Developer;
}
