/**
 * Auth Service
 *
 * Validates DataClaus user tokens and manages local sessions.
 */

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import {
  DataClausService,
  UserTokenPayload,
} from '../dataclaus/dataclaus.service';

export interface AuthenticatedUser {
  id: string;
  phone: string;
  email?: string;
  qualityScore: number;
  walletId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly dataclausService: DataClausService) {}

  /**
   * Verify a DataClaus user token.
   * This is called when the mobile app sends requests with a DataClaus token.
   */
  async verifyToken(token: string): Promise<AuthenticatedUser> {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }

    const payload = await this.dataclausService.verifyUserToken(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    this.logger.debug(`User authenticated: ${payload.userId}`);

    return {
      id: payload.userId,
      phone: payload.phone,
      email: payload.email,
      qualityScore: payload.qualityScore,
      walletId: payload.walletId,
    };
  }

  /**
   * Verify reCAPTCHA token for bot protection.
   * Called before sensitive operations like OTP verification.
   */
  async verifyRecaptcha(
    recaptchaToken: string,
    action: string,
    userIp?: string,
  ): Promise<{ isBot: boolean; score: number }> {
    const result = await this.dataclausService.verifyRecaptcha(
      recaptchaToken,
      action,
      userIp,
    );

    if (result.isBot) {
      this.logger.warn(
        `Bot detected for action ${action}, score: ${result.score}`,
      );
    }

    return {
      isBot: result.isBot,
      score: result.score,
    };
  }
}
