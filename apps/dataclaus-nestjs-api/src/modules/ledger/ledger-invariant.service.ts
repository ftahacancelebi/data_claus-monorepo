import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface InvariantCheckResult {
  ok: boolean;
  net: number;
  totalRows: number;
  orphans: number;
  checkedAt: string;
}

/**
 * Periodic verifier of the double-entry invariant:
 *
 *   SUM(amount) WHERE status='completed'  ===  0
 *
 * Every credit row has a paired debit row of equal magnitude with
 * opposite sign. If at any point this sum drifts off zero, somewhere a
 * row was inserted without its pair (a bug or a manual SQL fix). The
 * cron runs every 15 minutes and the admin endpoint exposes the same
 * computation for live demos.
 */
@Injectable()
export class LedgerInvariantService {
  private readonly logger = new Logger(LedgerInvariantService.name);
  private lastResult: InvariantCheckResult | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'ledger-invariant' })
  async runScheduled(): Promise<InvariantCheckResult> {
    const result = await this.verify();
    if (!result.ok) {
      this.logger.error(
        `LEDGER INVARIANT BROKEN: net=${result.net} orphans=${result.orphans}`,
      );
      this.eventEmitter.emit('ledger.invariant.broken', result);
    } else {
      this.logger.log(
        `Ledger invariant OK (rows=${result.totalRows}, net=${result.net})`,
      );
    }
    return result;
  }

  async verify(): Promise<InvariantCheckResult> {
    const rows = await this.dataSource.query<
      Array<{ net: string | null; rows: string; orphans: string }>
    >(
      `SELECT
         COALESCE(SUM(amount), 0)::text AS net,
         COUNT(*)::text AS rows,
         COUNT(*) FILTER (WHERE paired_transaction_id IS NULL)::text AS orphans
       FROM ledger_transactions
       WHERE status = 'completed'`,
    );
    const row = rows[0];
    const net = parseFloat(row?.net ?? '0');
    const totalRows = parseInt(row?.rows ?? '0', 10);
    const orphans = parseInt(row?.orphans ?? '0', 10);

    const result: InvariantCheckResult = {
      ok: Math.abs(net) < 1e-6 && orphans === 0,
      net,
      totalRows,
      orphans,
      checkedAt: new Date().toISOString(),
    };
    this.lastResult = result;
    return result;
  }

  getLastResult(): InvariantCheckResult | null {
    return this.lastResult;
  }
}
