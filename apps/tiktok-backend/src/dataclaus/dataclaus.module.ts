/**
 * DataClaus Module
 *
 * Provides the DataClaus SDK client as a NestJS service.
 * All communication with DataClaus API goes through this module.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataClausService } from './dataclaus.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DataClausService],
  exports: [DataClausService],
})
export class DataClausModule {}
