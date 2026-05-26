import {
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
  IsUUID,
  MinLength,
  IsOptional,
  IsArray,
  IsDateString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  CampaignStatus,
  CampaignTargeting,
  TargetingDeviceType,
} from '../../../common/constants';

export class CampaignTargetingDto implements CampaignTargeting {
  @ApiPropertyOptional({ type: [String], example: ['social', 'fitness'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  appCategories?: string[];

  @ApiPropertyOptional({ type: [String], example: ['US', 'TR'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({ example: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minQualityScore?: number;

  @ApiPropertyOptional({ enum: TargetingDeviceType, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TargetingDeviceType, { each: true })
  deviceTypes?: TargetingDeviceType[];

  @ApiPropertyOptional({ type: [String], example: ['action', 'fitness', 'lifestyle'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentTags?: string[];
}

export class CreateCampaignDto {
  @ApiProperty({ example: 'uuid-of-buyer' })
  @IsUUID()
  @Expose({ name: 'buyer_id' })
  buyer_id: string;

  @ApiProperty({ example: 'Summer Campaign 2026' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'High intent fitness audience' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @IsPositive()
  budget: number;

  @ApiPropertyOptional({ example: 0.005, description: 'USD per impression' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Expose({ name: 'bid_per_impression' })
  bid_per_impression?: number;

  @ApiPropertyOptional({ type: CampaignTargetingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignTargetingDto)
  targeting?: CampaignTargetingDto;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  @Expose({ name: 'starts_at' })
  starts_at?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  @Expose({ name: 'ends_at' })
  ends_at?: string;
}

export class UpdateCampaignStatusDto {
  @ApiProperty({ enum: CampaignStatus, example: CampaignStatus.PAUSED })
  @IsEnum(CampaignStatus)
  status: CampaignStatus;
}

export class CampaignResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  @Expose({ name: 'buyer_id' })
  buyer_id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty()
  budget: number;

  @ApiProperty()
  @Expose({ name: 'total_budget' })
  total_budget: number;

  @ApiProperty()
  remaining: number;

  @ApiProperty()
  @Expose({ name: 'spent_budget' })
  spent_budget: number;

  @ApiProperty()
  @Expose({ name: 'bid_per_impression' })
  bid_per_impression: number;

  @ApiProperty({ type: CampaignTargetingDto })
  targeting: CampaignTargeting;

  @ApiProperty({ enum: CampaignStatus })
  status: CampaignStatus;

  @ApiPropertyOptional()
  @Expose({ name: 'starts_at' })
  starts_at: Date | null;

  @ApiPropertyOptional()
  @Expose({ name: 'ends_at' })
  ends_at: Date | null;

  @ApiProperty()
  @Expose({ name: 'impressions_served' })
  impressions_served: number;

  @ApiProperty()
  @Expose({ name: 'unique_users_reached' })
  unique_users_reached: number;

  @ApiProperty()
  @Expose({ name: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @Expose({ name: 'updated_at' })
  updated_at: Date;
}
