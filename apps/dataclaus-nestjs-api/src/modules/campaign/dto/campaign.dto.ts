import {
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { CampaignStatus } from '../../../common/constants';

export class CreateCampaignDto {
  @ApiProperty({ example: 'uuid-of-buyer' })
  @IsUUID()
  @Expose({ name: 'buyer_id' })
  buyer_id: string;

  @ApiProperty({ example: 'Summer Campaign 2026' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @IsPositive()
  budget: number;
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

  @ApiProperty()
  budget: number;

  @ApiProperty()
  remaining: number;

  @ApiProperty({ enum: CampaignStatus })
  status: CampaignStatus;

  @ApiProperty()
  @Expose({ name: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @Expose({ name: 'updated_at' })
  updated_at: Date;
}
