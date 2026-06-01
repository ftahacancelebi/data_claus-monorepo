import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchEvent } from './entities';
import { InternalIngestController } from './internal-ingest.controller';
import { InternalIngestService } from './internal-ingest.service';
import { WatchStatsController } from './watch-stats.controller';
import { WatchStatsService } from './watch-stats.service';

@Module({
  imports: [TypeOrmModule.forFeature([WatchEvent])],
  controllers: [InternalIngestController, WatchStatsController],
  providers: [InternalIngestService, WatchStatsService],
  exports: [TypeOrmModule],
})
export class WatchEventsModule {}
