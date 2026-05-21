import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClaimedMetricsDto {
  @ApiProperty({ example: 12500 })
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  row_count: number;

  @ApiProperty({ example: 1820 })
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  unique_users: number;

  @ApiProperty({ example: '2025-09-01' })
  @IsDateString()
  date_range_start: string;

  @ApiProperty({ example: '2025-10-31' })
  @IsDateString()
  date_range_end: string;
}

export class CreatePackageDto {
  @ApiProperty({ example: 'iOS Fitness Engagement Sessions Q4 2025' })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    example: 'fitness',
    description: 'fitness | social | finance | entertainment | location | health | productivity | other',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category: string;

  @ApiProperty({ type: ClaimedMetricsDto })
  @ValidateNested()
  @Type(() => ClaimedMetricsDto)
  claimed_metrics: ClaimedMetricsDto;

  /**
   * field_name → type. Free-form object, kept small. The LLM sees this verbatim.
   * Example: `{ user_id: 'string', session_seconds: 'number', recorded_at: 'timestamp' }`
   */
  @ApiProperty({ example: { user_id: 'string', session_seconds: 'number' } })
  @IsObject()
  schema_json: Record<string, string>;

  /**
   * 5–10 representative rows. Capped to keep prompt token budget bounded
   * (see spec §6d).
   * @Type(() => Object) is REQUIRED — without it, class-transformer
   * (with enableImplicitConversion in main.ts) corrupts each row to [].
   */
  @ApiProperty({ type: 'array', items: { type: 'object' }, minItems: 5, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(10)
  @Type(() => Object)
  sample_rows: Record<string, unknown>[];

  @ApiProperty({ example: 49.99 })
  @IsNumber()
  @Min(0.01)
  @Max(100_000)
  price: number;

  @ApiPropertyOptional({ description: 'Optional: link to one of developer\'s registered applications' })
  @IsOptional()
  @IsString()
  application_id?: string;

  @ApiPropertyOptional({ description: 'Optional: multi-dimension payload map (structural validation upstream in extractor)' })
  @IsOptional()
  @IsObject()
  dimensions?: Record<string, unknown>;
}
