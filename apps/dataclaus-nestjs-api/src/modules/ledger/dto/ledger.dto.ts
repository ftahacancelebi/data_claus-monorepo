import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { TransactionType, TransactionStatus } from '../../../common/constants';

export class LedgerTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  @Expose({ name: 'source_wallet_id' })
  source_wallet_id: string;

  @ApiProperty()
  @Expose({ name: 'dest_wallet_id' })
  dest_wallet_id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional()
  @Expose({ name: 'reference_id' })
  reference_id?: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty()
  @Expose({ name: 'created_at' })
  created_at: Date;
}
