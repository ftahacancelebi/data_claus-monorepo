/**
 * Earnings Module
 *
 * Fetches earnings from the DataClaus Go API.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EarningsController } from './earnings.controller';

@Module({
  imports: [ConfigModule],
  controllers: [EarningsController],
})
export class EarningsModule {}
