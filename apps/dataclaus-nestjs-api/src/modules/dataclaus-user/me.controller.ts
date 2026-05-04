import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { AuditAction } from '../audit/audit.decorator';
import {
  EarningsByAppDto,
  LedgerPageDto,
  MeService,
  QualityHistoryPointDto,
  SessionDto,
} from './me.service';

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseInteger(value?: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : undefined;
}

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('earnings/by-app')
  @ApiOperation({
    summary: 'Per-application earnings summary for the current user',
  })
  @ApiResponse({ status: 200 })
  async earningsByApp(
    @CurrentUser() user: CurrentUserData,
  ): Promise<EarningsByAppDto[]> {
    return this.meService.getEarningsByApp(user.id);
  }

  @Get('ledger')
  @ApiOperation({
    summary: 'Paginated ledger history for the current user wallet',
  })
  @ApiResponse({ status: 200 })
  async ledger(
    @CurrentUser() user: CurrentUserData,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('applicationId') applicationId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<LedgerPageDto> {
    return this.meService.getLedger(user.id, {
      from: parseDate(from),
      to: parseDate(to),
      type,
      applicationId,
      page: parseInteger(page),
      pageSize: parseInteger(pageSize),
    });
  }

  @Get('quality-score-history')
  @ApiOperation({
    summary: 'Daily earnings + quality score average for the last 30 days',
  })
  @ApiResponse({ status: 200 })
  async qualityHistory(
    @CurrentUser() user: CurrentUserData,
    @Query('days') days?: string,
  ): Promise<QualityHistoryPointDto[]> {
    return this.meService.getQualityScoreHistory(
      user.id,
      parseInteger(days) ?? 30,
    );
  }

  @Get('sessions')
  @ApiOperation({
    summary: 'List recent login sessions inferred from the audit log',
  })
  @ApiResponse({ status: 200 })
  async listSessions(
    @CurrentUser() user: CurrentUserData,
  ): Promise<SessionDto[]> {
    return this.meService.listSessions(user.id);
  }

  @Delete('sessions/:id')
  @AuditAction({ action: 'user.session.revoked', targetType: 'session' })
  @ApiOperation({ summary: 'Revoke a specific session (best-effort)' })
  async revokeSession(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ status: string }> {
    await this.meService.revokeSession(user.id, id);
    return { status: 'ok' };
  }

  @Delete('sessions')
  @AuditAction({ action: 'user.sessions.revoked_all', targetType: 'session' })
  @ApiOperation({
    summary: 'Logout from all devices (clears refresh tokens)',
  })
  async revokeAll(
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ status: string }> {
    await this.meService.revokeAllSessions(user.id);
    return { status: 'ok' };
  }
}
