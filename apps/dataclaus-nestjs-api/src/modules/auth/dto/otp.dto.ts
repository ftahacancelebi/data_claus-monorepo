import { IsEmail, IsString, Length, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  /**
   * reCAPTCHA Enterprise token from the client.
   * Required in production; backend can run in simulation mode for capstone.
   */
  @ApiPropertyOptional({ description: 'reCAPTCHA Enterprise token' })
  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class OtpRequestResponseDto {
  @ApiProperty({ example: 'OTP delivered' })
  status: string;

  @ApiProperty({ example: 300 })
  expiresInSeconds: number;
}
