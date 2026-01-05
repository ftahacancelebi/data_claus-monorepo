import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  MIN_USER_SHARE_PERCENT,
  MAX_USER_SHARE_PERCENT,
} from '../../../common/constants';

export class CreateApplicationDto {
  @ApiProperty({ example: 'My Awesome App' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'A description of the app' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'gaming' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'https://myapp.com' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'website_url' })
  website_url?: string;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @IsInt()
  @Min(MIN_USER_SHARE_PERCENT)
  @Max(MAX_USER_SHARE_PERCENT)
  @Expose({ name: 'user_share_percent' })
  user_share_percent?: number;
}

export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {}

export class ToggleStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @Expose({ name: 'is_active' })
  is_active: boolean;
}

export class ApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  @Expose({ name: 'developer_id' })
  developer_id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiPropertyOptional()
  @Expose({ name: 'website_url' })
  website_url?: string;

  @ApiProperty()
  @Expose({ name: 'is_active' })
  is_active: boolean;

  @ApiProperty()
  @Expose({ name: 'total_events' })
  total_events: number;

  @ApiProperty()
  @Expose({ name: 'total_users' })
  total_users: number;

  @ApiProperty()
  @Expose({ name: 'total_revenue' })
  total_revenue: number;

  @ApiProperty()
  @Expose({ name: 'quality_score' })
  quality_score: number;

  @ApiPropertyOptional()
  @Expose({ name: 'last_event_at' })
  last_event_at?: Date;

  @ApiProperty()
  @Expose({ name: 'user_share_percent' })
  user_share_percent: number;

  @ApiPropertyOptional()
  @Expose({ name: 'api_key_prefix' })
  api_key_prefix?: string;

  @ApiPropertyOptional()
  @Expose({ name: 'api_key' })
  api_key?: string;

  @ApiProperty()
  @Expose({ name: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @Expose({ name: 'updated_at' })
  updated_at: Date;
}

export class ApplicationStatsDto {
  @ApiProperty()
  @Expose({ name: 'application_id' })
  application_id: string;

  @ApiProperty()
  @Expose({ name: 'total_events' })
  total_events: number;

  @ApiProperty()
  @Expose({ name: 'total_users' })
  total_users: number;

  @ApiProperty()
  @Expose({ name: 'total_revenue' })
  total_revenue: number;

  @ApiProperty()
  @Expose({ name: 'avg_quality' })
  avg_quality: number;

  @ApiProperty()
  @Expose({ name: 'events_today' })
  events_today: number;

  @ApiProperty()
  @Expose({ name: 'events_week' })
  events_week: number;

  @ApiProperty()
  @Expose({ name: 'events_month' })
  events_month: number;
}
