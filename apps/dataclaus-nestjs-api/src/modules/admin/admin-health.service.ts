import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LedgerInvariantService } from '../ledger/ledger-invariant.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export type HealthStatus = 'green' | 'yellow' | 'red';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  detail: string;
  metric?: number | string | null;
}

export interface HealthSummary {
  status: HealthStatus;
  checkedAt: string;
  checks: HealthCheck[];
}

@Injectable()
export class AdminHealthService {
  private readonly logger = new Logger('AdminHealthService');

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ledgerInvariant: LedgerInvariantService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async getFullHealth(): Promise<HealthSummary> {
    const checks: HealthCheck[] = [];
    checks.push(await this.checkPostgres());
    checks.push(await this.checkIngestRecency());
    checks.push(await this.checkLedgerInvariant());
    checks.push(this.checkWebSocket());
    checks.push(await this.checkWebhookOutbox());
    checks.push(await this.checkRecentDistribution());

    const status: HealthStatus = checks.some((c) => c.status === 'red')
      ? 'red'
      : checks.some((c) => c.status === 'yellow')
        ? 'yellow'
        : 'green';

    return {
      status,
      checkedAt: new Date().toISOString(),
      checks,
    };
  }

  private async checkPostgres(): Promise<HealthCheck> {
    try {
      const t0 = Date.now();
      const rows = await this.dataSource.query<
        Array<{ active: string }>
      >(
        `SELECT count(*)::text AS active FROM pg_stat_activity WHERE datname = current_database()`,
      );
      const active = parseInt(rows?.[0]?.active ?? '0', 10);
      const ms = Date.now() - t0;
      return {
        name: 'PostgreSQL',
        status: 'green',
        detail: `connected, ${active} active connection(s), ping ${ms}ms`,
        metric: active,
      };
    } catch (err) {
      return {
        name: 'PostgreSQL',
        status: 'red',
        detail: `connection failed: ${(err as Error).message}`,
      };
    }
  }

  private async checkIngestRecency(): Promise<HealthCheck> {
    try {
      const rows = await this.dataSource.query<
        Array<{ last_ts: string | null; last_minute: string }>
      >(
        `SELECT
           MAX(created_at)::text AS last_ts,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 minute')::text AS last_minute
         FROM scored_events`,
      );
      const lastTs = rows?.[0]?.last_ts;
      const lastMinute = parseInt(rows?.[0]?.last_minute ?? '0', 10);

      if (!lastTs) {
        return {
          name: 'Ingest pipeline',
          status: 'yellow',
          detail: 'no scored events recorded yet',
          metric: 0,
        };
      }
      const ageSec = Math.round((Date.now() - new Date(lastTs).getTime()) / 1000);
      const status: HealthStatus = ageSec < 120 ? 'green' : ageSec < 600 ? 'yellow' : 'red';
      return {
        name: 'Ingest pipeline',
        status,
        detail: `last event ${ageSec}s ago, ${lastMinute} events/min`,
        metric: lastMinute,
      };
    } catch (err) {
      return {
        name: 'Ingest pipeline',
        status: 'red',
        detail: `query failed: ${(err as Error).message}`,
      };
    }
  }

  private async checkLedgerInvariant(): Promise<HealthCheck> {
    try {
      const result = await this.ledgerInvariant.verify();
      const status: HealthStatus = result.ok ? 'green' : 'red';
      return {
        name: 'Ledger invariant',
        status,
        detail: result.ok
          ? `SUM=0 across ${result.totalRows} rows`
          : `BROKEN: net=${result.net}, orphans=${result.orphans}`,
        metric: result.net,
      };
    } catch (err) {
      return {
        name: 'Ledger invariant',
        status: 'red',
        detail: `check failed: ${(err as Error).message}`,
      };
    }
  }

  private checkWebSocket(): HealthCheck {
    try {
      const server = (this.realtimeGateway as unknown as { server?: { sockets?: { sockets?: Map<unknown, unknown> } } }).server;
      const connected = server?.sockets?.sockets?.size ?? 0;
      return {
        name: 'WebSocket',
        status: 'green',
        detail: `gateway listening, ${connected} connected client(s)`,
        metric: connected,
      };
    } catch (err) {
      return {
        name: 'WebSocket',
        status: 'yellow',
        detail: `gateway introspection failed: ${(err as Error).message}`,
      };
    }
  }

  private async checkWebhookOutbox(): Promise<HealthCheck> {
    try {
      const rows = await this.dataSource.query<
        Array<{ pending: string; failed: string }>
      >(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
           COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour')::text AS failed
         FROM webhook_deliveries`,
      );
      const pending = parseInt(rows?.[0]?.pending ?? '0', 10);
      const failed = parseInt(rows?.[0]?.failed ?? '0', 10);
      const status: HealthStatus = failed > 5 ? 'red' : pending > 50 ? 'yellow' : 'green';
      return {
        name: 'Webhook outbox',
        status,
        detail: `${pending} pending, ${failed} failed (last hour)`,
        metric: pending,
      };
    } catch (err) {
      return {
        name: 'Webhook outbox',
        status: 'yellow',
        detail: `outbox query skipped: ${(err as Error).message}`,
      };
    }
  }

  private async checkRecentDistribution(): Promise<HealthCheck> {
    try {
      const rows = await this.dataSource.query<
        Array<{ count: string; revenue: string }>
      >(
        `SELECT
           COUNT(*)::text AS count,
           COALESCE(SUM(gross_revenue), 0)::text AS revenue
         FROM ad_impressions
         WHERE created_at > NOW() - INTERVAL '5 minutes'`,
      );
      const count = parseInt(rows?.[0]?.count ?? '0', 10);
      const revenue = parseFloat(rows?.[0]?.revenue ?? '0');
      const status: HealthStatus = count > 0 ? 'green' : 'yellow';
      return {
        name: 'Revenue distribution (5m)',
        status,
        detail: `${count} impressions, $${revenue.toFixed(6)} gross`,
        metric: count,
      };
    } catch (err) {
      return {
        name: 'Revenue distribution (5m)',
        status: 'yellow',
        detail: `query failed: ${(err as Error).message}`,
      };
    }
  }
}
