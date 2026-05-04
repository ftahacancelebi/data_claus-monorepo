import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { ScoredEvent } from '../ingest/entities/scored-event.entity';
import { LedgerTransaction } from '../ledger/entities';
import { Wallet } from '../wallet/entities';
import { PayoutRequest } from '../payout/entities/payout-request.entity';
import { AuditService } from '../audit/audit.service';

const COOLING_OFF_DAYS = 30;

export interface DataExport {
  exportedAt: string;
  user: Partial<DataClausUser>;
  wallet: Wallet | null;
  scoredEvents: ScoredEvent[];
  ledgerTransactions: LedgerTransaction[];
  payouts: PayoutRequest[];
}

/**
 * Data Subject Access Request (KVKK / GDPR) operations:
 *   - Export: assemble all data tied to a user into a single JSON document.
 *   - Schedule deletion: mark the user with a 30-day `delete_after`, allowing
 *     cancellation. The scheduled job hard-deletes once the window elapses.
 *   - Cancel deletion: clear the timestamps if the user changes their mind.
 */
@Injectable()
export class DsarService {
  private readonly logger = new Logger(DsarService.name);

  constructor(
    @InjectRepository(DataClausUser)
    private readonly users: Repository<DataClausUser>,
    @InjectRepository(ScoredEvent)
    private readonly scoredEvents: Repository<ScoredEvent>,
    @InjectRepository(LedgerTransaction)
    private readonly ledger: Repository<LedgerTransaction>,
    @InjectRepository(Wallet)
    private readonly wallets: Repository<Wallet>,
    @InjectRepository(PayoutRequest)
    private readonly payouts: Repository<PayoutRequest>,
    private readonly auditService: AuditService,
  ) {}

  async exportUserData(userId: string): Promise<DataExport> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const wallet = user.walletId
      ? await this.wallets.findOne({ where: { id: user.walletId } })
      : null;

    const [scoredEvents, ledgerTransactions, payouts] = await Promise.all([
      this.scoredEvents.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
      wallet
        ? this.ledger.find({
            where: [
              { sourceWalletId: wallet.id },
              { destWalletId: wallet.id },
            ],
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve([]),
      this.payouts.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
    ]);

    await this.auditService.record({
      actorType: 'user',
      actorId: userId,
      action: 'dsar.export',
      targetType: 'user',
      targetId: userId,
      context: {
        eventCount: scoredEvents.length,
        ledgerCount: ledgerTransactions.length,
        payoutCount: payouts.length,
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      user: this.sanitizeUser(user),
      wallet,
      scoredEvents,
      ledgerTransactions,
      payouts,
    };
  }

  async requestDeletion(userId: string): Promise<{ deleteAfter: Date }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletionRequestedAt && user.deleteAfter) {
      throw new BadRequestException(
        'A deletion request is already pending; cancel it first to reset the window',
      );
    }

    const now = new Date();
    user.deletionRequestedAt = now;
    user.deleteAfter = new Date(
      now.getTime() + COOLING_OFF_DAYS * 24 * 60 * 60 * 1000,
    );
    await this.users.save(user);

    await this.auditService.record({
      actorType: 'user',
      actorId: userId,
      action: 'dsar.deletion.requested',
      targetType: 'user',
      targetId: userId,
      context: { deleteAfter: user.deleteAfter.toISOString() },
    });

    return { deleteAfter: user.deleteAfter };
  }

  async cancelDeletion(userId: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.deletionRequestedAt) return;

    user.deletionRequestedAt = null;
    user.deleteAfter = null;
    await this.users.save(user);

    await this.auditService.record({
      actorType: 'user',
      actorId: userId,
      action: 'dsar.deletion.cancelled',
      targetType: 'user',
      targetId: userId,
    });
  }

  /**
   * Hourly cron: hard-delete users whose `delete_after` has elapsed.
   * Scoped narrowly — only zeroes out PII columns and removes the row.
   * Ledger/event history is retained (unlinkable after deletion).
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'dsar-hard-delete' })
  async processScheduledDeletions(): Promise<void> {
    const due = await this.users.find({
      where: { deleteAfter: LessThan(new Date()) },
      take: 50,
    });
    for (const user of due) {
      try {
        await this.users.delete({ id: user.id });
        await this.auditService.record({
          actorType: 'system',
          actorId: 'system',
          action: 'dsar.deletion.executed',
          targetType: 'user',
          targetId: user.id,
        });
      } catch (err) {
        this.logger.error(
          `Hard delete failed for user=${user.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private sanitizeUser(user: DataClausUser): Partial<DataClausUser> {
    // Strip the password hash from exports — it should never leave the DB.
    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }
}
