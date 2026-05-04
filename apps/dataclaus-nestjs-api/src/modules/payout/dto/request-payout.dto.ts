import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PayoutMethod } from '../../../common/constants';

export class RequestPayoutDto {
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0.01)
  amount: number;

  @IsEnum(PayoutMethod)
  method: PayoutMethod;

  @IsOptional()
  @IsString()
  destination?: string;
}
