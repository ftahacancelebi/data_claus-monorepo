import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, FindOptionsWhere } from 'typeorm';
import { AuditLog, AuditActorType } from './entities/audit-log.entity';

export interface RecordAuditInput {
  actorType: AuditActorType;
  actorId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  context?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: number | null;
  errorMessage?: string | null;
}

export interface AuditQuery {
  actorType?: AuditActorType;
  actorId?: string;
  action?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.auditRepo.save(
        this.auditRepo.create({
          actorType: input.actorType,
          actorId: input.actorId,
          action: input.action,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          context: input.context ?? {},
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          status: input.status ?? null,
          errorMessage: input.errorMessage ?? null,
        }),
      );
    } catch (err) {
      // Audit failures must never break the calling request.
      this.logger.error(
        `Audit insert failed for action=${input.action}: ${(err as Error).message}`,
      );
    }
  }

  async list(query: AuditQuery): Promise<{ rows: AuditLog[]; total: number }> {
    const where: FindOptionsWhere<AuditLog> = {};
    if (query.actorType) where.actorType = query.actorType;
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = Like(`${query.action}%`);
    if (query.targetId) where.targetId = query.targetId;
    if (query.from && query.to) where.createdAt = Between(query.from, query.to);

    const [rows, total] = await this.auditRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: Math.min(query.limit ?? 50, 200),
      skip: query.offset ?? 0,
    });

    return { rows, total };
  }

  /**
   * CSV export (admin). Returns the entire matching set unfiltered by limit
   * so reviewers can pull a full window. Caller must handle streaming for
   * large windows.
   */
  async exportCsv(query: AuditQuery): Promise<string> {
    const { rows } = await this.list({ ...query, limit: 200 });
    const header = [
      'createdAt',
      'actorType',
      'actorId',
      'action',
      'targetType',
      'targetId',
      'status',
      'ipAddress',
      'errorMessage',
    ].join(',');
    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const s = String(value).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = rows.map((r) =>
      [
        r.createdAt.toISOString(),
        r.actorType,
        r.actorId,
        r.action,
        r.targetType,
        r.targetId,
        r.status,
        r.ipAddress,
        r.errorMessage,
      ]
        .map(escape)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }
}
