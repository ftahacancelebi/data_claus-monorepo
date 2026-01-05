import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ApiKey } from './api-key.entity';
import { Application } from '../../application/entities/application.entity';
import {
  DEFAULT_USER_SHARE_PERCENT,
  MIN_USER_SHARE_PERCENT,
  MAX_USER_SHARE_PERCENT,
  PLATFORM_FEE_PERCENT,
} from '../../../common/constants';

@Entity('developers')
export class Developer extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({
    name: 'user_share_percent',
    type: 'int',
    default: DEFAULT_USER_SHARE_PERCENT,
  })
  userSharePercent: number;

  @OneToMany(() => ApiKey, (apiKey) => apiKey.developer)
  apiKeys: ApiKey[];

  @OneToMany(() => Application, (app) => app.developer)
  applications: Application[];

  // Methods matching Go implementation
  setUserSharePercent(percent: number): void {
    if (percent < MIN_USER_SHARE_PERCENT || percent > MAX_USER_SHARE_PERCENT) {
      throw new Error(
        `User share must be between ${MIN_USER_SHARE_PERCENT}% and ${MAX_USER_SHARE_PERCENT}%`,
      );
    }
    this.userSharePercent = percent;
  }

  getDeveloperSharePercent(): number {
    return 100 - PLATFORM_FEE_PERCENT - this.userSharePercent;
  }
}
