/**
 * Auth Module
 *
 * Handles user authentication through DataClaus.
 * This is NOT a custom auth system - it verifies DataClaus user tokens.
 *
 * Flow:
 * 1. User logs in on mobile using DataClaus SDK
 * 2. Mobile sends DataClaus token to this backend
 * 3. Backend verifies token with DataClaus API
 * 4. Backend issues its own JWT for local session (optional)
 */

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
