import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Censored demographic profile. We deliberately store the BUCKET, never the
 * raw age. Gender is one of m/f/x. Locale is the ISO country code only —
 * no city, no IP-derived precision.
 */
@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'age_bucket', type: 'varchar', length: 10 })
  ageBucket: '18-24' | '25-34' | '35-44' | '45-54' | '55+';

  @Column({ type: 'varchar', length: 1 })
  gender: 'm' | 'f' | 'x';

  @Column({ type: 'varchar', length: 5 })
  locale: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
