/**
 * Auth Module
 *
 * Handles user authentication through DataClaus API.
 * Proxies OTP authentication flow to DataClaus Go API.
 */

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { DataClausModule } from '../dataclaus/dataclaus.module';

@Module({
  imports: [DataClausModule],
  controllers: [AuthController],
  exports: [],
})
export class AuthModule {}
