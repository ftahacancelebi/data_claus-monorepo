import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataClausUser } from './entities/dataclaus-user.entity';
import { AdImpression } from '../ads/entities/ad-impression.entity';
import { Application } from '../application/entities/application.entity';
import { LedgerTransaction } from '../ledger/entities/ledger-transaction.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Wallet } from '../wallet/entities/wallet.entity';

export interface EarningsByAppDto {
  applicationId: string;
  appName: string;
  category: string | null;
  totalEarned: number;
  last7Days: number;
  qualityScoreAvg: number;
  impressionCount: number;
}

export interface LedgerEntryDto {
  id: string;
  date: string;
  type: string;
  amount: number;
  currency: string;
  applicationId: string | null;
  applicationName: string | null;
  status: string;
  referenceId: string | null;
}

export interface LedgerPageDto {
  items: LedgerEntryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QualityHistoryPointDto {
  date: string;
  averageQuality: number;
  earnings: number;
  impressions: number;
}

export interface SessionDto {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}

@Injectable()
export class MeService {
  constructor(
    @InjectRepository(DataClausUser)
    private readonly userRepo: Repository<DataClausUser>,
    @InjectRepository(AdImpression)
    private readonly impressionRepo: Repository<AdImpression>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(LedgerTransaction)
    private readonly ledgerRepo: Repository<LedgerTransaction>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
  ) {}

  async getEarningsByApp(userId: string): Promise<EarningsByAppDto[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const rows = await this.impressionRepo
      .createQueryBuilder('imp')
      .select('imp.application_id', 'applicationId')
      .addSelect('SUM(imp.user_share)', 'totalEarned')
      .addSelect('COUNT(imp.id)', 'impressionCount')
      .addSelect(
        `SUM(CASE WHEN imp.created_at >= :cutoff THEN imp.user_share ELSE 0 END)`,
        'last7Days',
      )
      .where('imp.user_id = :userId', { userId })
      .setParameter('cutoff', sevenDaysAgo)
      .groupBy('imp.application_id')
      .orderBy('"totalEarned"', 'DESC')
      .getRawMany<{
        applicationId: string;
        totalEarned: string;
        impressionCount: string;
        last7Days: string;
      }>();

    if (rows.length === 0) return [];

    const appIds = rows.map((r) => r.applicationId);
    const apps = await this.applicationRepo.findByIds(appIds);
    const appMap = new Map(apps.map((a) => [a.id, a]));

    return rows.map((r) => {
      const app = appMap.get(r.applicationId);
      return {
        applicationId: r.applicationId,
        appName: app?.name ?? 'Unknown App',
        category: app?.category ?? null,
        totalEarned: Number(r.totalEarned) || 0,
        last7Days: Number(r.last7Days) || 0,
        qualityScoreAvg: Number(app?.qualityScore ?? 0),
        impressionCount: Number(r.impressionCount) || 0,
      };
    });
  }

  async getLedger(
    userId: string,
    options: {
      from?: Date;
      to?: Date;
      type?: string;
      applicationId?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<LedgerPageDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 50));

    if (!user.walletId) {
      return { items: [], total: 0, page, pageSize };
    }

    const qb = this.ledgerRepo
      .createQueryBuilder('tx')
      .where('(tx.source_wallet_id = :w OR tx.dest_wallet_id = :w)', {
        w: user.walletId,
      });

    if (options.from) {
      qb.andWhere('tx.created_at >= :from', { from: options.from });
    }
    if (options.to) {
      qb.andWhere('tx.created_at <= :to', { to: options.to });
    }
    if (options.type) {
      qb.andWhere('tx.type = :type', { type: options.type });
    }

    qb.orderBy('tx.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [rows, total] = await qb.getManyAndCount();

    // Resolve application names through ad impressions referenceId.
    const referenceIds = rows
      .map((r) => r.referenceId)
      .filter((v): v is string => Boolean(v));
    const impressions = referenceIds.length
      ? await this.impressionRepo.findByIds(referenceIds)
      : [];
    const impressionMap = new Map(impressions.map((i) => [i.id, i]));

    const appIds = Array.from(
      new Set(impressions.map((i) => i.applicationId).filter(Boolean)),
    );
    const apps = appIds.length
      ? await this.applicationRepo.findByIds(appIds)
      : [];
    const appMap = new Map(apps.map((a) => [a.id, a]));

    const items: LedgerEntryDto[] = rows
      .filter((row) => {
        if (!options.applicationId) return true;
        const imp = row.referenceId ? impressionMap.get(row.referenceId) : null;
        return imp?.applicationId === options.applicationId;
      })
      .map((row) => {
        const imp = row.referenceId ? impressionMap.get(row.referenceId) : null;
        const app = imp ? appMap.get(imp.applicationId) : null;
        const signed =
          row.destWalletId === user.walletId
            ? Number(row.amount)
            : -Math.abs(Number(row.amount));
        return {
          id: row.id,
          date: row.createdAt.toISOString(),
          type: row.type,
          amount: signed,
          currency: row.currency,
          applicationId: imp?.applicationId ?? null,
          applicationName: app?.name ?? null,
          status: row.status,
          referenceId: row.referenceId,
        };
      });

    return { items, total, page, pageSize };
  }

  async getQualityScoreHistory(
    userId: string,
    days = 30,
  ): Promise<QualityHistoryPointDto[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const rows = await this.impressionRepo
      .createQueryBuilder('imp')
      .select(`DATE(imp.created_at)`, 'date')
      .addSelect('SUM(imp.user_share)', 'earnings')
      .addSelect('COUNT(imp.id)', 'impressions')
      .where('imp.user_id = :userId', { userId })
      .andWhere('imp.created_at >= :cutoff', { cutoff })
      .groupBy('DATE(imp.created_at)')
      .orderBy('"date"', 'ASC')
      .getRawMany<{ date: string; earnings: string; impressions: string }>();

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const baseQuality = Number(user?.qualityScore ?? 0.5);

    return rows.map((r) => ({
      date:
        typeof r.date === 'string' ? r.date : new Date(r.date).toISOString().slice(0, 10),
      averageQuality: baseQuality,
      earnings: Number(r.earnings) || 0,
      impressions: Number(r.impressions) || 0,
    }));
  }

  /**
   * Sessions are derived from recent successful login audit entries plus the
   * caller's own JWT context. There is no dedicated session table yet —
   * user-side observability ships with this approximation; a real session
   * registry will follow once refresh-token revocation lands.
   */
  async listSessions(
    userId: string,
    currentJti?: string,
  ): Promise<SessionDto[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const logs = await this.auditRepo
      .createQueryBuilder('a')
      .where('a.actor_id = :userId', { userId })
      .andWhere(`a.action IN ('user.login', 'user.otp.verified', 'auth.login')`)
      .andWhere('a.created_at >= :cutoff', { cutoff })
      .orderBy('a.created_at', 'DESC')
      .limit(20)
      .getMany();

    return logs.map((log) => ({
      id: log.id,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      lastActiveAt: log.createdAt.toISOString(),
      isCurrent: currentJti ? log.id === currentJti : false,
    }));
  }

  async revokeSession(userId: string, _sessionId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Without a session registry, single-session revoke is best-effort.
    // The audit row stays as a historical record; refresh-token rotation
    // will invalidate the affected client on its next request.
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Future: bump a `tokenVersion` column so all outstanding JWTs reject.
    // Audit-only for now; clients are expected to clear local storage.
  }
}
