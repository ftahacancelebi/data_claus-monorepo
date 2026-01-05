/**
 * Videos Module
 *
 * Handles video feed and interactions.
 */

import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { DataClausModule } from '../dataclaus/dataclaus.module';

@Module({
  imports: [DataClausModule],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
