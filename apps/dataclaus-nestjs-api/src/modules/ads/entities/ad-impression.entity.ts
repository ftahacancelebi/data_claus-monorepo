import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  AdType,
  ECPM_BANNER,
  ECPM_INTERSTITIAL,
  ECPM_REWARDED,
} from '../../../common/constants';

@Entity('ad_impressions')
@Index('uq_ad_impressions_nonce', ['slotNonce'], {
  unique: true,
  where: 'slot_nonce IS NOT NULL',
})
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

  /**
   * Server-issued slot nonce that was sealed into this impression. The unique
   * partial index above prevents replays — the same slot token cannot be
   * sealed twice.
   */
  @Column({ name: 'slot_nonce', type: 'varchar', length: 64, nullable: true })
  slotNonce: string | null;

  /**
   * When the impression was sealed (i.e. slot token was redeemed). Distinct
   * from `createdAt` (which equals seal time today, but kept for clarity).
   */
  @Column({ name: 'sealed_at', type: 'timestamp', nullable: true })
  sealedAt: Date | null;

  /**
   * Set true when ad-network reporting later confirms the revenue. Until then
   * `grossRevenue` reflects the campaign auction bid (or fallback eCPM). For
   * the demo, this stays false — production would reconcile via AdMob API.
   */
  @Column({ name: 'revenue_confirmed', type: 'boolean', default: false })
  revenueConfirmed: boolean;

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
