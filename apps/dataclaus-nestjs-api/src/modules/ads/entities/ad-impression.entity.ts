import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  AdType,
  ECPM_BANNER,
  ECPM_INTERSTITIAL,
  ECPM_REWARDED,
} from '../../../common/constants';

@Entity('ad_impressions')
export class AdImpression extends BaseEntity {
  // Relationships
  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'developer_id', type: 'uuid' })
  developerId: string;

  // Optional campaign that funded this impression (Phase 6 marketplace).
  // Null indicates fallback eCPM (no matched campaign).
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId: string | null;

  // Ad Details
  @Column({ name: 'ad_type', type: 'enum', enum: AdType })
  adType: AdType;

  @Column({ name: 'ad_unit_id', type: 'varchar', length: 100, nullable: true })
  adUnitId: string | null;

  @Column({
    name: 'ad_network_name',
    type: 'varchar',
    length: 50,
    default: 'admob',
  })
  adNetworkName: string;

  // Revenue (in USD)
  @Column({ name: 'gross_revenue', type: 'decimal', precision: 18, scale: 8 })
  grossRevenue: number;

  @Column({ name: 'user_share', type: 'decimal', precision: 18, scale: 8 })
  userShare: number;

  @Column({ name: 'dev_share', type: 'decimal', precision: 18, scale: 8 })
  devShare: number;

  @Column({ name: 'platform_fee', type: 'decimal', precision: 18, scale: 8 })
  platformFee: number;

  // Distribution Status
  @Column({ type: 'boolean', default: false })
  distributed: boolean;

  @Column({ name: 'distributed_at', type: 'timestamp', nullable: true })
  distributedAt: Date | null;

  // Tracking
  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 50, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'device_info', type: 'text', nullable: true })
  deviceInfo: string | null;

  @Column({ name: 'country_code', type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'varchar', length: 10, default: 'USD' })
  currency: string;

  // Static methods matching Go implementation
  static getEcpmByAdType(adType: AdType): number {
    switch (adType) {
      case AdType.BANNER:
        return ECPM_BANNER;
      case AdType.INTERSTITIAL:
        return ECPM_INTERSTITIAL;
      case AdType.REWARDED:
        return ECPM_REWARDED;
      default:
        return ECPM_BANNER;
    }
  }

  static getRevenuePerImpression(adType: AdType): number {
    return this.getEcpmByAdType(adType) / 1000.0;
  }
}
