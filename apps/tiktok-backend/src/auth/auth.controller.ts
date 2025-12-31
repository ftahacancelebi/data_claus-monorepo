/**
 * Auth Controller
 *
 * Exposes endpoints for the mobile app to:
 * - Verify DataClaus tokens
 * - Get current user profile
 *
 * Note: The actual OTP flow is handled by DataClaus API directly.
 * This backend just verifies the resulting tokens.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UnauthorizedException,
  Ip,
} from '@nestjs/common';
import { AuthService, AuthenticatedUser } from './auth.service';

class VerifyTokenDto {
  token!: string;
}

class VerifyRecaptchaDto {
  token!: string;
  action!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Verify a DataClaus user token.
   * The mobile app calls this after getting a token from DataClaus.
   */
  @Post('verify-token')
  async verifyToken(@Body() dto: VerifyTokenDto): Promise<{
    valid: boolean;
    user: AuthenticatedUser;
  }> {
    const user = await this.authService.verifyToken(dto.token);
    return { valid: true, user };
  }

  /**
   * Get current user from Authorization header.
   */
  @Get('me')
  async getMe(
    @Headers('authorization') authHeader?: string,
  ): Promise<AuthenticatedUser> {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    return this.authService.verifyToken(token);
  }

  /**
   * Verify reCAPTCHA token for bot protection.
   * Called before sensitive operations.
   */
  @Post('verify-recaptcha')
  async verifyRecaptcha(
    @Body() dto: VerifyRecaptchaDto,
    @Ip() ip: string,
  ): Promise<{ isBot: boolean; score: number }> {
    return this.authService.verifyRecaptcha(dto.token, dto.action, ip);
  }
}
