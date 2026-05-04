import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { HmacGuard, HmacContext } from '../../common/guards/hmac.guard';
import { IngestBatchDto } from './dto/ingest-batch.dto';
import { IngestService } from './ingest.service';

@ApiTags('Ingest')
@Controller('v1/ingest')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  /**
   * POST /v1/ingest/batch
   *
   * HMAC-protected batch ingest endpoint. The dev backend / Node SDK
   * forwards mobile sensor batches here. Each event must include a
   * client-side fraudScore (0..1). Server-side anomaly checks are run
   * in IngestValidatorService before any wallet credit.
   */
  @Public() // bypass JWT guard; HMAC takes over
  @UseGuards(HmacGuard)
  @Throttle({ medium: { limit: 1000, ttl: 60_000 } }) // 1000 batches/min per IP
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('hmac')
  @ApiOperation({ summary: 'Ingest a batch of scored sensor events (HMAC)' })
  @ApiResponse({ status: 200, description: 'Batch processed' })
  @ApiResponse({ status: 401, description: 'Invalid HMAC signature' })
  async ingestBatch(@Req() req: Request, @Body() dto: IngestBatchDto) {
    const ctx = (req as unknown as { hmacContext?: HmacContext })
      .hmacContext;
    if (!ctx?.applicationId) {
      // ApiKey not bound to an application — capstone constraint
      return {
        accepted: 0,
        rejected: dto.events.length,
        scoredEventIds: [],
        rejections: dto.events.map((e) => ({
          eventId: e.eventId,
          reason: 'api_key_not_bound_to_app',
        })),
      };
    }
    return this.ingestService.handleBatch(ctx.applicationId, dto);
  }
}
