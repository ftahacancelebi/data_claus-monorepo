import {
  IsString,
  IsEnum,
  IsUUID,
  IsNumber,
  IsOptional,
  IsPositive,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { AdType } from '../../../common/constants';

/**
 * Internal-only DTO. Public SDK callers MUST use the slot/seal flow
 * (RequestAdSlotDto + SealImpressionDto). This shape is kept for admin
 * tooling and the legacy controller path during the migration window.
 *
 * `gross_revenue` from a public client is IGNORED in production code paths —
 * see `ads.controller.ts` and `ads.service.ts`. Revenue is resolved
 * server-side from the campaign auction or ad-network reporting.
 */
export class RecordImpressionDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsUUID()
  @Expose({ name: 'user_id' })
  user_id: string;

  @ApiProperty({ enum: AdType, example: AdType.REWARDED })
  @IsEnum(AdType)
  @Expose({ name: 'ad_type' })
  ad_type: AdType;

  @ApiPropertyOptional({ example: 'ca-app-pub-xxx/xxx' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'ad_unit_id' })
  ad_unit_id?: string;

  @ApiPropertyOptional({
    example: 0.015,
    description:
      'INTERNAL ONLY. Ignored on public endpoints — server resolves revenue.',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Expose({ name: 'gross_revenue' })
  gross_revenue?: number;

  @ApiPropertyOptional({ example: 'session-uuid' })
  @IsOptional()
  @IsUUID()
  @Expose({ name: 'session_id' })
  session_id?: string;

  @ApiPropertyOptional({
    example: 0.85,
    description: 'User quality score (0-1) used for campaign targeting',
  })
  @IsOptional()
  @IsNumber()
  @Expose({ name: 'quality_score' })
  quality_score?: number;
}

/**
 * Public SDK calls this first, BEFORE rendering any ad. Server replies with a
 * short-lived signed slot token. The token binds: appId, userId, adType,
 * server-resolved adUnitId, and a unique nonce. SDK MUST present this token
 * back when sealing an impression.
 */
export class RequestAdSlotDto {
  @ApiProperty({ enum: AdType, example: AdType.REWARDED })
  @IsEnum(AdType)
  @Expose({ name: 'ad_type' })
  ad_type: AdType;

  @ApiProperty({ example: 'user-uuid' })
  @IsUUID()
  @Expose({ name: 'user_id' })
  user_id: string;

  @ApiPropertyOptional({ example: 'session-uuid' })
  @IsOptional()
  @IsUUID()
  @Expose({ name: 'session_id' })
  session_id?: string;

  /**
   * Optional client-asserted quality score. Server treats this as a HINT
   * only — the authoritative quality score comes from server-side fraud
   * detection. Used for campaign targeting tie-breaks.
   */
  @ApiPropertyOptional({ example: 0.85 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Expose({ name: 'quality_score_hint' })
  quality_score_hint?: number;

  /**
   * Platform attestation token (Apple App Attest / Play Integrity). Required
   * in production builds, optional in dev/test mode.
   */
  @ApiPropertyOptional({ description: 'Platform attestation envelope (base64)' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'attestation' })
  attestation?: string;
}

export class SignedAdSlotDto {
  @ApiProperty({ description: 'Opaque signed token — opaque to the SDK' })
  @Expose({ name: 'slot_token' })
  slot_token: string;

  @ApiProperty({ description: 'Server-resolved ad unit identifier' })
  @Expose({ name: 'ad_unit_id' })
  ad_unit_id: string;

  @ApiProperty({ enum: AdType })
  @Expose({ name: 'ad_type' })
  ad_type: AdType;

  @ApiProperty({ description: 'Slot expires at (ISO timestamp)' })
  @Expose({ name: 'expires_at' })
  expires_at: string;

  @ApiProperty({
    description:
      'Server-side projected gross revenue for UI display. NOT trusted by ledger — final revenue resolved at seal time.',
  })
  @Expose({ name: 'projected_revenue' })
  projected_revenue: number;
}

/**
 * SDK calls this AFTER the platform ad SDK reports the ad rendered/viewed.
 * The slot_token is required and replay-protected (one-shot).
 */
export class SealImpressionDto {
  @ApiProperty({ description: 'Slot token issued by /ads/slot' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'slot_token' })
  slot_token: string;

  /**
   * Optional ad-network reported revenue (e.g. AdMob paid event). Server
   * uses this only as a CROSS-CHECK against its own reporting reconciliation
   * — never as the sole source of truth.
   */
  @ApiPropertyOptional({
    example: 0.015,
    description:
      'Ad-network reported revenue (cross-check signal, not authoritative)',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Expose({ name: 'reported_revenue' })
  reported_revenue?: number;

  /**
   * For rewarded ads: did the user complete the full view? Server validates
   * this against ad-network reporting before crediting reward share.
   */
  @ApiPropertyOptional({ description: 'Rewarded ad full view flag' })
  @IsOptional()
  @Expose({ name: 'completed' })
  completed?: boolean;
}

export class AdRatesResponseDto {
  @ApiProperty()
  @Expose({ name: 'banner_ecpm' })
  banner_ecpm: number;

  @ApiProperty()
  @Expose({ name: 'interstitial_ecpm' })
  interstitial_ecpm: number;

  @ApiProperty()
  @Expose({ name: 'rewarded_ecpm' })
  rewarded_ecpm: number;
}

export class AdRevenueSummaryDto {
  @ApiProperty()
  @Expose({ name: 'total_impressions' })
  total_impressions: number;

  @ApiProperty()
  @Expose({ name: 'total_gross_revenue' })
  total_gross_revenue: number;

  @ApiProperty()
  @Expose({ name: 'total_user_share' })
  total_user_share: number;

  @ApiProperty()
  @Expose({ name: 'total_dev_share' })
  total_dev_share: number;

  @ApiProperty()
  @Expose({ name: 'total_platform_fee' })
  total_platform_fee: number;

  @ApiProperty()
  @Expose({ name: 'average_ecpm' })
  average_ecpm: number;

  @ApiProperty()
  @Expose({ name: 'banner_impressions' })
  banner_impressions: number;

  @ApiProperty()
  @Expose({ name: 'interstitial_count' })
  interstitial_count: number;

  @ApiProperty()
  @Expose({ name: 'rewarded_count' })
  rewarded_count: number;
}

export class AdConfigResponseDto {
  @ApiProperty()
  @Expose({ name: 'application_id' })
  application_id: string;

  @ApiProperty()
  @Expose({ name: 'user_share_percent' })
  user_share_percent: number;

  @ApiProperty()
  @Expose({ name: 'dev_share_percent' })
  dev_share_percent: number;

  @ApiProperty()
  @Expose({ name: 'platform_percent' })
  platform_percent: number;

  @ApiProperty({ type: [String] })
  @Expose({ name: 'enabled_ad_types' })
  enabled_ad_types: AdType[];

  @ApiProperty()
  @Expose({ name: 'minimum_ecpm' })
  minimum_ecpm: number;
}

export class ImpressionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  @Expose({ name: 'application_id' })
  application_id: string;

  @ApiProperty()
  @Expose({ name: 'user_id' })
  user_id: string;

  @ApiProperty()
  @Expose({ name: 'developer_id' })
  developer_id: string;

  @ApiProperty({ enum: AdType })
  @Expose({ name: 'ad_type' })
  ad_type: AdType;

  @ApiProperty()
  @Expose({ name: 'gross_revenue' })
  gross_revenue: number;

  @ApiProperty()
  @Expose({ name: 'user_share' })
  user_share: number;

  @ApiProperty()
  @Expose({ name: 'dev_share' })
  dev_share: number;

  @ApiProperty()
  @Expose({ name: 'platform_fee' })
  platform_fee: number;

  @ApiPropertyOptional({
    description: 'Campaign that funded this impression (null = fallback eCPM)',
  })
  @Expose({ name: 'campaign_id' })
  campaign_id: string | null;

  @ApiProperty()
  @Expose({ name: 'created_at' })
  created_at: Date;
}
