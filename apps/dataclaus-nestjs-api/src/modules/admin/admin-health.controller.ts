import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { AdminHealthService, HealthSummary } from './admin-health.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/health')
export class AdminHealthController {
  constructor(private readonly healthService: AdminHealthService) {}

  @Get('full')
  @Public() // health endpoint is intentionally readable by demo polling client
  @ApiOperation({
    summary: 'Aggregate platform health (Postgres, ingest, ledger, WS, webhooks)',
  })
  @ApiResponse({ status: 200, description: 'Aggregate health snapshot' })
  async getFullHealth(): Promise<HealthSummary> {
    return this.healthService.getFullHealth();
  }
}
