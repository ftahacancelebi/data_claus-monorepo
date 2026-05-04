import { IsString, MaxLength } from 'class-validator';

export class AdminRejectPayoutDto {
  @IsString()
  @MaxLength(256)
  reason: string;
}
