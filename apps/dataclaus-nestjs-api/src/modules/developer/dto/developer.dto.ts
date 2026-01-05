import {
  IsString,
  IsEmail,
  MinLength,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  MIN_USER_SHARE_PERCENT,
  MAX_USER_SHARE_PERCENT,
} from '../../../common/constants';

export class RegisterDeveloperDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

export class UpdateUserShareDto {
  @ApiProperty({
    example: 70,
    minimum: MIN_USER_SHARE_PERCENT,
    maximum: MAX_USER_SHARE_PERCENT,
  })
  @IsInt()
  @Min(MIN_USER_SHARE_PERCENT)
  @Max(MAX_USER_SHARE_PERCENT)
  @Expose({ name: 'user_share_percent' })
  user_share_percent: number;
}

export class GenerateApiKeyDto {
  @ApiProperty({ example: 'Production API Key' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 'uuid-of-application' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'application_id' })
  application_id?: string;
}

export class DeveloperResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  @Expose({ name: 'user_share_percent' })
  user_share_percent: number;

  @ApiProperty()
  @Expose({ name: 'dev_share_percent' })
  dev_share_percent: number;

  @ApiProperty()
  @Expose({ name: 'created_at' })
  created_at: Date;

  @ApiProperty()
  @Expose({ name: 'updated_at' })
  updated_at: Date;
}

export class ApiKeyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  @Expose({ name: 'key_prefix' })
  key_prefix: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  @Expose({ name: 'is_active' })
  is_active: boolean;

  @ApiProperty({ required: false })
  @Expose({ name: 'last_used_at' })
  last_used_at?: Date;

  @ApiProperty()
  @Expose({ name: 'created_at' })
  created_at: Date;
}

export class GeneratedApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({ description: 'Full API key (only shown once)' })
  @Expose({ name: 'raw_key' })
  raw_key: string;
}
