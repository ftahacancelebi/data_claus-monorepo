import {
  IsString,
  IsIn,
  IsISO8601,
  IsNumber,
  Min,
  Max,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const INGEST_EVENT_TYPES = [
  'accelerometer',
  'gyroscope',
  'touch',
  'scroll',
  'session',
  'screen_view',
] as const;

export type IngestEventType = (typeof INGEST_EVENT_TYPES)[number];

export class DeviceInfoDto {
  @IsOptional()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}

export class IngestEventDto {
  @IsString()
  eventId: string;

  @IsString()
  externalUserId: string;

  @IsIn(INGEST_EVENT_TYPES as unknown as string[])
  eventType: IngestEventType;

  @IsISO8601()
  timestamp: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  fraudScore: number;

  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device?: DeviceInfoDto;
}
