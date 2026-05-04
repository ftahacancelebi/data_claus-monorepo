import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayoutRequest } from './entities/payout-request.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import {
  RequestPayoutDto,
  PayoutResponseDto,
  AdminRejectPayoutDto,
} from './dto';
import {
  MIN_PAYOUT_THRESHOLD,
  PayoutMethod,
  PayoutStatus,
  SYSTEM_WALLET_IDS,
  TransactionType,
} from '../../common/constants';
import { FinancialTxService } from '../ledger/financial-tx.service';
import { StripeSimulationProvider } from './providers/stripe-simulation.provider';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    @InjectRepository(PayoutRequest)
    private readonly payoutRepository: Repository<PayoutRequest>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly financialTx: FinancialTxService,
    private readonly stripeProvider: StripeSimulationProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestPayout(
    userId: string,
    dto: RequestPayoutDto,
  ): Promise<PayoutResponseDto> {
    if (dto.amount < MIN_PAYOUT_THRESHOLD) {
      throw new BadRequestException(
        `Amount below minimum payout threshold ($${MIN_PAYOUT_THRESHOLD})`,
      );
    }

    const wallet = await this.walletRepository.findOne({
      where: { ownerId: userId },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (Number(wallet.balance) < dto.amount) {
      throw new BadRequestException(
        'Insufficient available balance. Release pending balance first.',
      );
    }

    const persisted = await this.financialTx.runInTransaction(async (qr) => {
      const request = qr.manager.create(PayoutRequest, {
        userId,
        walletId: wallet.id,
        amount: dto.amount,
        currency: wallet.currency,
        method: dto.method,
        status: PayoutStatus.REQUESTED,
        metadata: dto.destination ? { destination: dto.destination } : null,
      });
      const saved = await qr.manager.save(request);

      // Hold: move funds from user wallet → PAYOUT_TREASURY system wallet.
      // This ensures the user can't double-spend while the request is open.
      const { creditId } = await this.financialTx.transferAtomic(qr, {
        sourceWalletId: wallet.id,
        destWalletId: SYSTEM_WALLET_IDS.PAYOUT_TREASURY,
        amount: dto.amount,
        currency: wallet.currency,
        referenceId: saved.id,
        type: TransactionType.WITHDRAWAL,
        target: 'available',
        metadata: {
          stage: 'hold',
          method: dto.method,
        },
      });

      saved.holdLedgerId = creditId;
      await qr.manager.save(saved);
      return saved;
    });

    this.eventEmitter.emit('payout.requested', {
      payoutId: persisted.id,
      userId,
      amount: dto.amount,
      method: dto.method,
    });

    return this.toResponse(persisted);
  }

  async listMine(userId: string): Promise<PayoutResponseDto[]> {
    const rows = await this.payoutRepository.find({
      where: { userId },
      order: { requestedAt: 'DESC' },
    });
    return rows.map((r) => this.toResponse(r));
  }

  async getOne(id: string, userId: string): Promise<PayoutResponseDto> {
    const row = await this.payoutRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Payout not found');
    if (row.userId !== userId) {
      throw new ForbiddenException('Cannot access another user payout');
    }
    return this.toResponse(row);
  }

  async listAll(): Promise<PayoutResponseDto[]> {
    const rows = await this.payoutRepository.find({
      order: { requestedAt: 'DESC' },
      take: 200,
    });
    return rows.map((r) => this.toResponse(r));
  }

  async adminApprove(
    id: string,
    adminId: string,
  ): Promise<PayoutResponseDto> {
    const row = await this.requireRequest(id, [PayoutStatus.REQUESTED]);

    const providerResult = await this.stripeProvider.sendPayout({
      payoutId: row.id,
      amount: Number(row.amount),
      currency: row.currency,
      method: row.method,
      destination: (row.metadata?.destination as string | undefined) ?? undefined,
    });

    const persisted = await this.financialTx.runInTransaction(async (qr) => {
      const fresh = await qr.manager.findOne(PayoutRequest, {
        where: { id: row.id },
      });
      if (!fresh) throw new NotFoundException('Payout vanished');

      if (!providerResult.ok) {
        // Provider declined — release the hold back to the user wallet.
        await this.releaseHold(qr, fresh);
        fresh.status = PayoutStatus.FAILED;
        fresh.completedAt = new Date();
        fresh.processedByAdminId = adminId;
        fresh.rejectionReason = providerResult.message;
        fresh.metadata = {
          ...(fresh.metadata ?? {}),
          provider: providerResult,
        };
        await qr.manager.save(fresh);
        return fresh;
      }

      fresh.status = PayoutStatus.COMPLETED;
      fresh.approvedAt = new Date();
      fresh.completedAt = new Date();
      fresh.processedByAdminId = adminId;
      fresh.metadata = {
        ...(fresh.metadata ?? {}),
        provider: providerResult,
      };
      await qr.manager.save(fresh);
      return fresh;
    });

    this.eventEmitter.emit('payout.completed', {
      payoutId: persisted.id,
      userId: persisted.userId,
      amount: Number(persisted.amount),
      ok: providerResult.ok,
      providerReference: providerResult.providerReference,
    });

    return this.toResponse(persisted);
  }

  async adminReject(
    id: string,
    adminId: string,
    dto: AdminRejectPayoutDto,
  ): Promise<PayoutResponseDto> {
    const row = await this.requireRequest(id, [PayoutStatus.REQUESTED]);

    const persisted = await this.financialTx.runInTransaction(async (qr) => {
      const fresh = await qr.manager.findOne(PayoutRequest, {
        where: { id: row.id },
      });
      if (!fresh) throw new NotFoundException('Payout vanished');

      await this.releaseHold(qr, fresh);

      fresh.status = PayoutStatus.REJECTED;
      fresh.rejectedAt = new Date();
      fresh.processedByAdminId = adminId;
      fresh.rejectionReason = dto.reason;
      await qr.manager.save(fresh);
      return fresh;
    });

    this.eventEmitter.emit('payout.rejected', {
      payoutId: persisted.id,
      userId: persisted.userId,
      reason: dto.reason,
    });

    return this.toResponse(persisted);
  }

  /**
   * Reverses the WITHDRAWAL hold: PAYOUT_TREASURY → user wallet, with a
   * paired WITHDRAWAL_REVERSAL ledger row so the invariant stays at 0.
   */
  private async releaseHold(
    qr: QueryRunner,
    request: PayoutRequest,
  ): Promise<void> {
    await this.financialTx.transferAtomic(qr, {
      sourceWalletId: SYSTEM_WALLET_IDS.PAYOUT_TREASURY,
      destWalletId: request.walletId,
      amount: Number(request.amount),
      currency: request.currency,
      referenceId: request.id,
      type: TransactionType.WITHDRAWAL_REVERSAL,
      target: 'available',
      metadata: {
        stage: 'release_hold',
        method: request.method,
      },
    });
  }

  private async requireRequest(
    id: string,
    allowedStatuses: PayoutStatus[],
  ): Promise<PayoutRequest> {
    const row = await this.payoutRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Payout not found');
    if (!allowedStatuses.includes(row.status)) {
      throw new BadRequestException(
        `Payout in status '${row.status}' cannot be processed (expected: ${allowedStatuses.join(', ')})`,
      );
    }
    return row;
  }

  private toResponse(row: PayoutRequest): PayoutResponseDto {
    return {
      id: row.id,
      user_id: row.userId,
      wallet_id: row.walletId,
      amount: Number(row.amount),
      currency: row.currency,
      method: row.method,
      status: row.status,
      requested_at: row.requestedAt,
      approved_at: row.approvedAt,
      completed_at: row.completedAt,
      rejected_at: row.rejectedAt,
      rejection_reason: row.rejectionReason,
      metadata: row.metadata,
    };
  }
}
