import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const WEBHOOK_EVENT_TYPES = [
  'wallet.credited',
  'wallet.debited',
  'payout.requested',
  'payout.completed',
  'payout.rejected',
  'application.user_linked',
  'quality_score.changed',
  'score.calculated',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export class CreateEndpointDto {
  @ApiProperty({ example: 'https://example.com/webhooks/dataclaus' })
  @IsUrl({ require_protocol: true, require_tld: false })
  @MaxLength(1000)
  url: string;

  @ApiPropertyOptional({ example: 'Production webhook' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description:
      'Subscribed event types. Empty = subscribe to all known events.',
    example: ['wallet.credited', 'payout.completed'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  eventTypes?: string[];
}

export class UpdateEndpointDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  eventTypes?: string[];
}

export class CreateSecretDto {
  @ApiPropertyOptional({ example: 'rotation-2026-q2' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  label?: string;
}

export class TestEventDto {
  @ApiProperty({ example: 'wallet.credited' })
  @IsString()
  @MaxLength(64)
  eventType: string;

  @ApiPropertyOptional()
  @IsOptional()
  payload?: Record<string, unknown>;
}
