import {
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IngestEventDto } from './ingest-event.dto';

export class SessionInfoDto {
  @IsString()
  sessionId: string;

  @IsOptional()
  @IsString()
  startedAt?: string;

  @IsOptional()
  @IsString()
  externalUserId?: string;
}

export class IngestBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => IngestEventDto)
  events: IngestEventDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => SessionInfoDto)
  session: SessionInfoDto;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

export interface IngestResultDto {
  accepted: number;
  rejected: number;
  scoredEventIds: string[];
  rejections: { eventId: string; reason: string }[];
}
