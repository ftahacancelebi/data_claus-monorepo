import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchEvent } from './entities';
import { InternalIngestController } from './internal-ingest.controller';
import { InternalIngestService } from './internal-ingest.service';

@Module({
  imports: [TypeOrmModule.forFeature([WatchEvent])],
  controllers: [InternalIngestController],
  providers: [InternalIngestService],
  exports: [TypeOrmModule],
})
export class WatchEventsModule {}
