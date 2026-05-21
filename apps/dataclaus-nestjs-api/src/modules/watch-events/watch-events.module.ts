import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchEvent } from './entities/watch-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WatchEvent])],
  exports: [TypeOrmModule],
})
export class WatchEventsModule {}
