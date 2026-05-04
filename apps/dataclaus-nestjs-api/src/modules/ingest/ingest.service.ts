import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Application } from '../application/entities';
import { Wallet } from '../wallet/entities';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { FinancialTxService } from '../ledger/financial-tx.service';
import { TransactionType } from '../../common/constants';
import {
  EVENT_BASE_CPM,
  EVENT_DEFAULT_CPM,
} from '../../common/constants';
import { ScoredEvent } from './entities/scored-event.entity';
import {
  IngestBatchDto,
  IngestEventDto,
  IngestResultDto,
} from './dto';
import { IngestValidatorService } from './ingest-validator.service';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    @InjectRepository(ScoredEvent)
    private readonly scoredEventRepo: Repository<ScoredEvent>,
    @InjectRepository(DataClausUser)
    private readonly userRepo: Repository<DataClausUser>,
    private readonly validator: IngestValidatorService,
    private readonly financialTx: FinancialTxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleBatch(
    applicationId: string,
    dto: IngestBatchDto,
  ): Promise<IngestResultDto> {
    const application = await this.appRepo.findOne({
      where: { id: applicationId, isActive: true },
    });
    if (!application) {
      throw new NotFoundException('Application not active');
    }

    const result: IngestResultDto = {
      accepted: 0,
      rejected: 0,
      scoredEventIds: [],
      rejections: [],
    };

    for (const event of dto.events) {
      try {
        const outcome = await this.processEvent(event, application);
        if (outcome.accepted) {
          result.accepted += 1;
          result.scoredEventIds.push(outcome.scoredEventId!);
        } else {
          result.rejected += 1;
          result.rejections.push({
            eventId: event.eventId,
            reason: outcome.reason ?? 'unknown',
          });
        }
      } catch (err) {
        // Per-event errors should not abort the batch; log and count.
        this.logger.error(
          `Ingest event ${event.eventId} failed: ${
            (err as Error).message
          }`,
        );
        result.rejected += 1;
        result.rejections.push({
          eventId: event.eventId,
          reason: 'internal_error',
        });
      }
    }

    return result;
  }

  private async processEvent(
    event: IngestEventDto,
    application: Application,
  ): Promise<{
    accepted: boolean;
    scoredEventId?: string;
    reason?: string;
  }> {
    // 1. Replay guard
    const exists = await this.scoredEventRepo.exists({
      where: { eventId: event.eventId },
    });
    if (exists) {
      return { accepted: false, reason: 'replay_event_id' };
    }

    // 2. Server-side validation
    const verdict = this.validator.validate(event, application);
    if (!verdict.ok) {
      const userId = await this.tryResolveUserId(event.externalUserId);
      await this.scoredEventRepo.save(
        this.toRejectedRow(event, application, userId, verdict.reason!),
      );
      return { accepted: false, reason: verdict.reason };
    }

    // 3. Resolve target DataClaus user (capstone shortcut: externalUserId
    // must equal a DataClausUser.id; fail-soft if not found)
    const userId = await this.tryResolveUserId(event.externalUserId);
    if (!userId) {
      await this.scoredEventRepo.save(
        this.toRejectedRow(
          event,
          application,
          null,
          'unknown_external_user',
        ),
      );
      return { accepted: false, reason: 'unknown_external_user' };
    }

    // 4. Score → payout
    const qualityScore = this.clamp01(1 - event.fraudScore);
    const baseCpm = EVENT_BASE_CPM[event.eventType] ?? EVENT_DEFAULT_CPM;
    const payoutAmount = Number(
      ((baseCpm / 1000) * qualityScore).toFixed(8),
    );

    // 5. Atomic insert + wallet credit
    const scored = await this.financialTx.runInTransaction(async (qr) => {
      const row = await qr.manager.save(ScoredEvent, {
        eventId: event.eventId,
        applicationId: application.id,
        userId,
        developerId: application.developerId,
        eventType: event.eventType,
        sessionId: event.sessionId ?? null,
        fraudScore: event.fraudScore,
        qualityScore,
        payoutAmount,
        rawPayload: this.compactPayload(event.payload),
        status: 'scored',
        rejectionReason: null,
        ingestedAt: new Date(),
        scoredAt: new Date(),
      });

      if (payoutAmount > 0) {
        const wallet = await this.findUserWallet(qr.manager, userId);
        if (wallet) {
          await this.financialTx.creditPendingBalance(qr, {
            destWalletId: wallet.id,
            amount: payoutAmount,
            currency: wallet.currency,
            referenceId: row.id,
            type: TransactionType.AD_REVENUE,
          });
        } else {
          this.logger.warn(
            `User ${userId} has no wallet; payout skipped for event ${row.id}`,
          );
        }
      }
      return row;
    });

    // 6. Emit in-process event for WebSocket gateway (Phase 4)
    this.eventEmitter.emit('score.calculated', {
      eventId: scored.id,
      applicationId: application.id,
      developerId: application.developerId,
      userId,
      qualityScore,
      payoutAmount,
      eventType: scored.eventType,
      scoredAt: scored.scoredAt,
    });

    return { accepted: true, scoredEventId: scored.id };
  }

  private clamp01(x: number): number {
    if (Number.isNaN(x)) return 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  private compactPayload(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    // Strip oversized arrays/raw sensor streams to keep storage bounded.
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload ?? {})) {
      if (Array.isArray(v) && v.length > 100) {
        out[k] = { _truncated: true, length: v.length, sample: v.slice(0, 5) };
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private async tryResolveUserId(
    externalUserId: string,
  ): Promise<string | null> {
    if (!this.isUuid(externalUserId)) return null;
    const user = await this.userRepo.findOne({
      where: { id: externalUserId },
      select: ['id'],
    });
    return user?.id ?? null;
  }

  private async findUserWallet(
    manager: EntityManager,
    userId: string,
  ): Promise<Wallet | null> {
    const wallet = await manager.findOne(Wallet, {
      where: { ownerId: userId },
    });
    return wallet ?? null;
  }

  private toRejectedRow(
    event: IngestEventDto,
    application: Application,
    userId: string | null,
    reason: string,
  ): Partial<ScoredEvent> {
    const qualityScore = this.clamp01(1 - event.fraudScore);
    return {
      eventId: event.eventId,
      applicationId: application.id,
      userId: userId ?? '00000000-0000-0000-0000-000000000000',
      developerId: application.developerId,
      eventType: event.eventType,
      sessionId: event.sessionId ?? null,
      fraudScore: event.fraudScore,
      qualityScore,
      payoutAmount: 0,
      rawPayload: this.compactPayload(event.payload),
      status: 'rejected',
      rejectionReason: reason,
      ingestedAt: new Date(),
      scoredAt: null,
    };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
