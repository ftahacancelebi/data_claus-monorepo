import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeGateway } from './realtime.gateway';

export interface ScoreCalculatedPayload {
  eventId: string;
  applicationId: string;
  developerId: string;
  userId: string;
  qualityScore: number;
  payoutAmount: number;
  eventType: string;
  scoredAt: Date | string | null;
}

export interface WalletCreditedPayload {
  impressionId?: string;
  applicationId?: string;
  userId: string;
  developerId?: string;
  userShare?: number;
  devShare?: number;
  platformFee?: number;
  grossRevenue?: number;
  adType?: string;
  newBalance?: number;
}

export interface PayoutCompletedPayload {
  payoutRequestId: string;
  userId: string;
  amount: number;
  method: string;
}

export interface PackagePurchasedPayload {
  packageId: string;
  purchaseId: string;
  buyerId: string;
  developerId: string;
  amount: number;
  sellerCut: number;
  platformFee: number;
}

/**
 * EventEmitter2 → WebSocket bridge.
 *
 * Listens for in-process domain events emitted by the ingest, ads and
 * payout services and pushes them to the appropriate Socket.IO rooms.
 *
 * Phase 8+ scale: replace these `@OnEvent` decorators with Kafka or
 * Redis Pub/Sub consumers without changing the gateway API.
 */
@Injectable()
export class RealtimeBridge {
  private readonly logger = new Logger(RealtimeBridge.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent('score.calculated', { async: true })
  handleScored(payload: ScoreCalculatedPayload): void {
    this.gateway.emitToUser(payload.userId, 'event:scored', payload);
    this.gateway.emitToDeveloper(
      payload.developerId,
      'event:scored',
      payload,
    );
    this.gateway.emitToApplication(
      payload.applicationId,
      'event:scored',
      payload,
    );
  }

  @OnEvent('wallet.credited', { async: true })
  handleWalletCredited(payload: WalletCreditedPayload): void {
    if (payload.userId) {
      this.gateway.emitToUser(payload.userId, 'wallet:credited', payload);
    }
    if (payload.developerId) {
      this.gateway.emitToDeveloper(
        payload.developerId,
        'wallet:credited',
        payload,
      );
    }
    if (payload.applicationId) {
      this.gateway.emitToApplication(
        payload.applicationId,
        'wallet:credited',
        payload,
      );
    }
  }

  @OnEvent('payout.completed', { async: true })
  handlePayoutCompleted(payload: PayoutCompletedPayload): void {
    this.gateway.emitToUser(payload.userId, 'payout:completed', payload);
  }

  /**
   * Marketplace sale → push a `wallet:credited` frame to the SELLER so their
   * earnings/wallet UI updates in the same render cycle the buyer purchases
   * (spec §8 step 7 — the "full loop closes on screen" moment).
   *
   * Reuses the existing `wallet:credited` event + frontend cache-patch listener
   * (see web `dashboard/wallet/page.tsx`) deliberately: zero frontend change,
   * the seller just needs an open session on a page that listens. `devShare`
   * is what the listener credits; `adType` drives the toast copy.
   */
  @OnEvent('package.purchased', { async: true })
  handlePackagePurchased(payload: PackagePurchasedPayload): void {
    const walletEvent: WalletCreditedPayload = {
      userId: '',
      developerId: payload.developerId,
      devShare: payload.sellerCut,
      platformFee: payload.platformFee,
      grossRevenue: payload.amount,
      adType: 'Data package sale',
    };
    this.gateway.emitToDeveloper(
      payload.developerId,
      'wallet:credited',
      walletEvent,
    );
  }
}
