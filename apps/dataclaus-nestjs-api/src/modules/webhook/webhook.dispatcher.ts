import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookService } from './webhook.service';
import { WebhookDelivery } from './entities/webhook-delivery.entity';

const RETRY_DELAYS_MS = [1_000, 5_000, 25_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const REQUEST_TIMEOUT_MS = 5_000;
const ENDPOINT_FAILURE_DISABLE_THRESHOLD = 25;

/**
 * Listens to in-process EventEmitter events and:
 *   1. Persists a `pending` row in `webhook_deliveries` for each subscribing
 *      endpoint (outbox pattern — survives in-process crashes once written).
 *   2. Runs a cron worker every few seconds that picks up pending/failed
 *      deliveries (where `next_attempt_at <= now`) and POSTs them with an
 *      HMAC signature.
 *
 * Retry policy: 3 attempts at 1s / 5s / 25s. On the 4th would-be attempt,
 * the delivery transitions to `dead_letter`. Persistent endpoint failures
 * (25 dead letters) auto-disable the endpoint to protect the dispatcher
 * from a runaway target.
 */
@Injectable()
export class WebhookDispatcher {
  private readonly logger = new Logger(WebhookDispatcher.name);

  constructor(private readonly webhookService: WebhookService) {}

  // ---------------------------------------------------------------------------
  // Event subscriptions
  // ---------------------------------------------------------------------------

  @OnEvent('wallet.credited')
  onWalletCredited(payload: Record<string, unknown>) {
    void this.enqueue('wallet.credited', payload);
  }

  @OnEvent('wallet.debited')
  onWalletDebited(payload: Record<string, unknown>) {
    void this.enqueue('wallet.debited', payload);
  }

  @OnEvent('payout.requested')
  onPayoutRequested(payload: Record<string, unknown>) {
    void this.enqueue('payout.requested', payload);
  }

  @OnEvent('payout.completed')
  onPayoutCompleted(payload: Record<string, unknown>) {
    void this.enqueue('payout.completed', payload);
  }

  @OnEvent('payout.rejected')
  onPayoutRejected(payload: Record<string, unknown>) {
    void this.enqueue('payout.rejected', payload);
  }

  @OnEvent('score.calculated')
  onScoreCalculated(payload: Record<string, unknown>) {
    void this.enqueue('score.calculated', payload);
  }

  @OnEvent('application.user_linked')
  onUserLinked(payload: Record<string, unknown>) {
    void this.enqueue('application.user_linked', payload);
  }

  @OnEvent('quality_score.changed')
  onQualityChanged(payload: Record<string, unknown>) {
    void this.enqueue('quality_score.changed', payload);
  }

  // ---------------------------------------------------------------------------
  // Cron worker
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_5_SECONDS, { name: 'webhook-dispatcher-tick' })
  async tick(): Promise<void> {
    let claimed: WebhookDelivery[];
    try {
      claimed = await this.webhookService.claimPendingDeliveries(new Date());
    } catch (err) {
      this.logger.error(
        `Claim pending failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return;
    }

    if (claimed.length === 0) return;

    await Promise.all(claimed.map((d) => this.deliverOne(d)));
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async enqueue(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const developerId = (payload?.developerId as string | undefined) ?? undefined;
      await this.webhookService.enqueueDelivery({
        eventType,
        payload,
        developerId,
      });
    } catch (err) {
      // Never let webhook persistence failures bubble up into the producer
      // (e.g., the ingest path). Log and move on.
      this.logger.error(
        `Enqueue failed for ${eventType}: ${(err as Error).message}`,
      );
    }
  }

  private async deliverOne(delivery: WebhookDelivery): Promise<void> {
    const secret = await this.webhookService.findActiveSecret(
      delivery.endpointId,
    );
    if (!secret) {
      // No active secret — mark as failed (developer must rotate / create one)
      await this.webhookService.markDeliveryResult(delivery, {
        status: 'dead_letter',
        lastError: 'no_active_secret',
        lastAttemptAt: new Date(),
      });
      return;
    }

    const endpoint = await this.webhookService.getEndpointInternal(
      delivery.endpointId,
    );
    if (!endpoint || !endpoint.enabled) {
      await this.webhookService.markDeliveryResult(delivery, {
        status: 'dead_letter',
        lastError: 'endpoint_disabled',
        lastAttemptAt: new Date(),
      });
      return;
    }

    const body = JSON.stringify({
      id: delivery.eventId,
      type: delivery.eventType,
      data: delivery.payload,
      createdAt: delivery.createdAt,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = WebhookService.signPayload(
      secret.secretHash,
      body,
      timestamp,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const attemptIndex = delivery.attempts;
    const isLastAttempt = attemptIndex + 1 >= MAX_ATTEMPTS;
    const now = new Date();

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DataClaus-Signature': signature,
          'X-DataClaus-Event': delivery.eventType,
          'X-DataClaus-Event-Id': delivery.eventId,
          'X-DataClaus-Delivery': delivery.id,
          'X-DataClaus-Attempt': String(attemptIndex + 1),
        },
        body,
        signal: controller.signal,
      });

      const responseBody = await res.text().catch(() => '');
      clearTimeout(timer);

      if (res.ok) {
        await this.webhookService.markDeliveryResult(delivery, {
          status: 'sent',
          attempts: attemptIndex + 1,
          lastAttemptAt: now,
          lastResponseStatus: res.status,
          lastResponseBody: responseBody.slice(0, 4000),
          lastError: null,
        });
        await this.webhookService.recordEndpointSuccess(endpoint.id);
        return;
      }

      await this.handleFailure({
        delivery,
        attemptIndex,
        isLastAttempt,
        now,
        responseStatus: res.status,
        responseBody,
        error: `HTTP ${res.status}`,
      });
    } catch (err) {
      clearTimeout(timer);
      await this.handleFailure({
        delivery,
        attemptIndex,
        isLastAttempt,
        now,
        responseStatus: null,
        responseBody: null,
        error: (err as Error).message,
      });
    }
  }

  private async handleFailure(args: {
    delivery: WebhookDelivery;
    attemptIndex: number;
    isLastAttempt: boolean;
    now: Date;
    responseStatus: number | null;
    responseBody: string | null;
    error: string;
  }): Promise<void> {
    const {
      delivery,
      attemptIndex,
      isLastAttempt,
      now,
      responseStatus,
      responseBody,
      error,
    } = args;

    const nextAttempts = attemptIndex + 1;
    if (isLastAttempt) {
      await this.webhookService.markDeliveryResult(delivery, {
        status: 'dead_letter',
        attempts: nextAttempts,
        lastAttemptAt: now,
        lastResponseStatus: responseStatus,
        lastResponseBody: responseBody?.slice(0, 4000) ?? null,
        lastError: error.slice(0, 500),
        nextAttemptAt: null,
      });
      await this.webhookService.recordEndpointFailure(
        delivery.endpointId,
        ENDPOINT_FAILURE_DISABLE_THRESHOLD,
      );
      return;
    }

    const delay = RETRY_DELAYS_MS[nextAttempts] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    await this.webhookService.markDeliveryResult(delivery, {
      status: 'failed',
      attempts: nextAttempts,
      lastAttemptAt: now,
      lastResponseStatus: responseStatus,
      lastResponseBody: responseBody?.slice(0, 4000) ?? null,
      lastError: error.slice(0, 500),
      nextAttemptAt: new Date(now.getTime() + delay),
    });
  }
}
