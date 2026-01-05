import {
  IsString,
  IsEnum,
  IsNumber,
  IsPositive,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { WalletType } from '../../../common/constants';

export class CreateWalletDto {
  @ApiProperty({ example: 'uuid-of-owner' })
  @IsUUID()
  @Expose({ name: 'owner_id' })
  owner_id: string;

  @ApiProperty({ enum: WalletType, example: WalletType.USER })
  @IsEnum(WalletType)
  type: WalletType;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class CreditDebitDto {
  @ApiProperty({ example: 10.5 })
  @IsNumber()
  @IsPositive()
  amount: number;
}

export class WalletResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  @Expose({ name: 'owner_id' })
  owner_id: string;

  @ApiProperty({ enum: WalletType })
  type: WalletType;

  @ApiProperty()
  balance: number;

  @ApiProperty()
  @Expose({ name: 'pending_balance' })
  pending_balance: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  @Expose({ name: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @Expose({ name: 'updated_at' })
  updated_at: Date;
}

export class RevenueSharesResponseDto {
  @ApiProperty()
  @Expose({ name: 'platform_fee_percent' })
  platform_fee_percent: number;

  @ApiProperty()
  @Expose({ name: 'user_share_percent' })
  user_share_percent: number;

  @ApiProperty()
  @Expose({ name: 'developer_share_percent' })
  developer_share_percent: number;

  @ApiProperty()
  @Expose({ name: 'min_payout_threshold' })
  min_payout_threshold: number;
}
