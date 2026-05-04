import {
  Controller,
  Get,
  Query,
  UseGuards,
  Header,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, Role } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService, AuditQuery } from './audit.service';
import { AuditActorType } from './entities/audit-log.entity';

const ALLOWED_ACTOR_TYPES: AuditActorType[] = [
  'admin',
  'developer',
  'user',
  'buyer',
  'system',
  'anonymous',
];

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseActorType(value?: string): AuditActorType | undefined {
  if (!value) return undefined;
  return ALLOWED_ACTOR_TYPES.includes(value as AuditActorType)
    ? (value as AuditActorType)
    : undefined;
}

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries (admin only)' })
  list(
    @Query('actorType') actorType?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('targetId') targetId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const query: AuditQuery = {
      actorType: parseActorType(actorType),
      actorId,
      action,
      targetId,
      from: parseDate(from),
      to: parseDate(to),
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    };
    return this.auditService.list(query);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-log.csv"')
  @ApiOperation({ summary: 'Export audit log as CSV (admin only)' })
  async exportCsv(
    @Res() res: Response,
    @Query('actorType') actorType?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.auditService.exportCsv({
      actorType: parseActorType(actorType),
      action,
      from: parseDate(from),
      to: parseDate(to),
    });
    res.send(csv);
  }
}
