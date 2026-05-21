import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngestWatchEventDto } from './dto/ingest-watch-event.dto';
import { InternalIngestService } from './internal-ingest.service';

@Controller('v1/internal/watch-events')
export class InternalIngestController {
  constructor(
    private readonly service: InternalIngestService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async ingest(
    @Body() dto: IngestWatchEventDto,
    @Headers('x-internal-secret') secret?: string,
  ): Promise<{ ok: true }> {
    const expected = this.config.get<string>('INTERNAL_INGEST_SECRET');
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid internal ingest secret');
    }
    await this.service.ingest(dto);
    return { ok: true };
  }
}
