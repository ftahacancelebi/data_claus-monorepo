import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators';
import { IngestWatchEventDto } from './dto/ingest-watch-event.dto';
import { InternalIngestService } from './internal-ingest.service';

@Public()
@Controller('v1/internal/watch-events')
export class InternalIngestController {
  constructor(
    private readonly service: InternalIngestService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @Throttle({ medium: { limit: 600, ttl: 60_000 } })
  async ingest(
    @Body() dto: IngestWatchEventDto,
    @Headers('x-internal-secret') secret?: string,
  ): Promise<{ ok: true }> {
    const expected = this.config.get<string>('INTERNAL_INGEST_SECRET');
    const provided = secret ?? '';
    const expectedBuf = Buffer.from(expected ?? '', 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    if (
      !expected ||
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException('Invalid internal ingest secret');
    }
    await this.service.ingest(dto);
    return { ok: true };
  }
}
