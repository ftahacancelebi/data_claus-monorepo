import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Developer } from '../developer/entities';
import { AdImpression } from '../ads/entities';
import { Campaign } from '../campaign/entities';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Developer,
      AdImpression,
      Campaign,
      DataClausUser,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
