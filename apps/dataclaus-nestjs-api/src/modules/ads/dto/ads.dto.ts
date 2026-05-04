import {
  IsString,
  IsEnum,
  IsUUID,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { AdType } from '../../../common/constants';

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

  @ApiPropertyOptional({ example: 0.015 })
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
