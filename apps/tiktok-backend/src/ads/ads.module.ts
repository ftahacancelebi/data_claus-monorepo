/**
 * Ads Module
 *
 * Proxies ad requests to the DataClaus Go API.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdsController } from './ads.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AdsController],
})
export class AdsModule {}
