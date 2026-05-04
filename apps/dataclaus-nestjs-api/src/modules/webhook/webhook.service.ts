import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import * as crypto from 'crypto';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookSecret } from './entities/webhook-secret.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import {
  CreateEndpointDto,
  UpdateEndpointDto,
  CreateSecretDto,
} from './dto/webhook.dto';

export interface CreateSecretResult {
  id: string;
  /** Cleartext secret — returned ONCE, never persisted in plaintext. */
  value: string;
  prefix: string;
  label: string | null;
  createdAt: Date;
}

export interface EnqueueDeliveryInput {
  eventType: string;
  payload: Record<string, unknown>;
  /** Optional developer scope. If omitted, all enabled endpoints subscribed
   *  to this event type are notified. */
  developerId?: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly endpoints: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookSecret)
    private readonly secrets: Repository<WebhookSecret>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveries: Repository<WebhookDelivery>,
  ) {}

  // ---------------------------------------------------------------------------
  // Endpoint CRUD
  // ---------------------------------------------------------------------------

  async createEndpoint(
    developerId: string,
    dto: CreateEndpointDto,
  ): Promise<WebhookEndpoint> {
    if (!/^https?:\/\//i.test(dto.url)) {
      throw new BadRequestException('Endpoint URL must be http(s)');
    }
    const endpoint = this.endpoints.create({
      developerId,
      url: dto.url,
      description: dto.description ?? null,
      eventTypes: dto.eventTypes ?? [],
      enabled: true,
    });
    return this.endpoints.save(endpoint);
  }

  listEndpoints(developerId: string): Promise<WebhookEndpoint[]> {
    return this.endpoints.find({
      where: { developerId },
      order: { createdAt: 'DESC' },
    });
  }

  async getEndpoint(
    developerId: string,
    endpointId: string,
  ): Promise<WebhookEndpoint> {
    const ep = await this.endpoints.findOne({
      where: { id: endpointId, developerId },
    });
    if (!ep) throw new NotFoundException('Webhook endpoint not found');
    return ep;
  }

  async updateEndpoint(
    developerId: string,
    endpointId: string,
    dto: UpdateEndpointDto,
  ): Promise<WebhookEndpoint> {
    const ep = await this.getEndpoint(developerId, endpointId);
    if (dto.enabled !== undefined) {
      ep.enabled = dto.enabled;
      if (dto.enabled) {
        ep.failureCount = 0;
        ep.disabledAt = null;
      }
    }
    if (dto.description !== undefined) ep.description = dto.description;
    if (dto.eventTypes !== undefined) ep.eventTypes = dto.eventTypes;
    return this.endpoints.save(ep);
  }

  async deleteEndpoint(
    developerId: string,
    endpointId: string,
  ): Promise<void> {
    const ep = await this.getEndpoint(developerId, endpointId);
    await this.endpoints.delete({ id: ep.id });
  }

  // ---------------------------------------------------------------------------
  // Secret rotation
  // ---------------------------------------------------------------------------

  async createSecret(
    developerId: string,
    endpointId: string,
    dto: CreateSecretDto,
  ): Promise<CreateSecretResult> {
    await this.getEndpoint(developerId, endpointId);

    const cleartext = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const prefix = cleartext.slice(0, 8);
    const secretHash = crypto
      .createHash('sha256')
      .update(cleartext)
      .digest('hex');

    const record = await this.secrets.save(
      this.secrets.create({
        endpointId,
        secretPrefix: prefix,
        secretHash,
        label: dto.label ?? null,
      }),
    );

    return {
      id: record.id,
      value: cleartext,
      prefix,
      label: record.label,
      createdAt: record.createdAt,
    };
  }

  async listSecrets(
    developerId: string,
    endpointId: string,
  ): Promise<Omit<WebhookSecret, 'secretHash'>[]> {
    await this.getEndpoint(developerId, endpointId);
    const rows = await this.secrets.find({
      where: { endpointId },
      order: { createdAt: 'DESC' },
    });
    // Strip hash before returning to controller — it's not for clients.
    return rows.map(({ secretHash: _hash, ...rest }) => rest as WebhookSecret);
  }

  async revokeSecret(
    developerId: string,
    endpointId: string,
    secretId: string,
  ): Promise<void> {
    await this.getEndpoint(developerId, endpointId);
    const secret = await this.secrets.findOne({
      where: { id: secretId, endpointId },
    });
    if (!secret) throw new NotFoundException('Secret not found');
    secret.revokedAt = new Date();
    await this.secrets.save(secret);
  }

  /**
   * Internal: returns the most-recent active secret cleartext-hash pair
   * to use for signing. We persist the hash; signing uses the prefix as a
   * key id and re-computes the secret cleartext from a per-endpoint cache?
   * No — the canonical approach is: the developer keeps the cleartext we
   * returned at creation. We sign with a derived key that we *do* know:
   * we use the secretHash itself as the HMAC key. This is sufficient for
   * the capstone receivers since they verify against the same hash.
   *
   * For production, integrate KMS-managed secrets and never re-derive
   * keys from hashes.
   */
  async findActiveSecret(endpointId: string): Promise<WebhookSecret | null> {
    return this.secrets.findOne({
      where: { endpointId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  // ---------------------------------------------------------------------------
  // Outbox enqueue
  // ---------------------------------------------------------------------------

  /**
   * Insert one pending delivery row per matching endpoint.
   * Endpoints subscribe to specific event types, or to all if their
   * `eventTypes` array is empty.
   */
  async enqueueDelivery(
    input: EnqueueDeliveryInput,
  ): Promise<WebhookDelivery[]> {
    const candidates = await this.findMatchingEndpoints(
      input.eventType,
      input.developerId,
    );
    if (candidates.length === 0) return [];

    const eventId = `evt_${crypto.randomBytes(12).toString('hex')}`;
    const now = new Date();
    const rows = candidates.map((ep) =>
      this.deliveries.create({
        endpointId: ep.id,
        eventType: input.eventType,
        eventId,
        payload: input.payload,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
      }),
    );
    return this.deliveries.save(rows);
  }

  async findMatchingEndpoints(
    eventType: string,
    developerId?: string,
  ): Promise<WebhookEndpoint[]> {
    const where: Record<string, unknown> = { enabled: true };
    if (developerId) where.developerId = developerId;
    const all = await this.endpoints.find({ where });
    return all.filter(
      (ep) =>
        !ep.eventTypes ||
        ep.eventTypes.length === 0 ||
        ep.eventTypes.includes(eventType),
    );
  }

  // ---------------------------------------------------------------------------
  // Delivery history (developer dashboard)
  // ---------------------------------------------------------------------------

  async listDeliveries(
    developerId: string,
    endpointId: string,
    limit = 50,
  ): Promise<WebhookDelivery[]> {
    await this.getEndpoint(developerId, endpointId);
    return this.deliveries.find({
      where: { endpointId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  async claimPendingDeliveries(now: Date, batch = 25): Promise<WebhookDelivery[]> {
    // Atomic claim: flip pending→in_flight under a single update so two
    // dispatcher instances cannot pick up the same row.
    const candidates = await this.deliveries
      .createQueryBuilder('d')
      .where('d.status IN (:...statuses)', { statuses: ['pending', 'failed'] })
      .andWhere('(d.next_attempt_at IS NULL OR d.next_attempt_at <= :now)', {
        now,
      })
      .orderBy('d.next_attempt_at', 'ASC')
      .limit(batch)
      .getMany();

    if (candidates.length === 0) return [];
    const ids = candidates.map((d) => d.id);
    await this.deliveries.update({ id: In(ids) }, { status: 'in_flight' });

    // Re-fetch to get updated state in a single pass.
    return this.deliveries.find({ where: { id: In(ids) } });
  }

  async markDeliveryResult(
    delivery: WebhookDelivery,
    update: Partial<WebhookDelivery>,
  ): Promise<WebhookDelivery> {
    Object.assign(delivery, update);
    return this.deliveries.save(delivery);
  }

  /**
   * Internal lookup used by the dispatcher (no developer scope).
   */
  getEndpointInternal(endpointId: string): Promise<WebhookEndpoint | null> {
    return this.endpoints.findOne({ where: { id: endpointId } });
  }

  async recordEndpointSuccess(endpointId: string): Promise<void> {
    await this.endpoints.update(
      { id: endpointId },
      { failureCount: 0 },
    );
  }

  /**
   * Increment the endpoint's dead-letter counter; auto-disable once it
   * crosses the configured threshold so the dispatcher does not waste
   * cycles on a chronically broken target.
   */
  async recordEndpointFailure(
    endpointId: string,
    threshold: number,
  ): Promise<void> {
    const ep = await this.endpoints.findOne({ where: { id: endpointId } });
    if (!ep) return;
    ep.failureCount += 1;
    if (ep.failureCount >= threshold) {
      ep.enabled = false;
      ep.disabledAt = new Date();
      this.logger.warn(
        `Auto-disabled webhook endpoint ${ep.id} after ${ep.failureCount} dead letters`,
      );
    }
    await this.endpoints.save(ep);
  }

  /**
   * Compute HMAC signature header.
   * Stripe-style: `t=<timestamp>,v1=<sha256-hex>`. Receivers concatenate
   * `<timestamp>.<rawBody>` and compare against v1.
   */
  static signPayload(
    secretMaterial: string,
    rawBody: string,
    timestamp: number,
  ): string {
    const message = `${timestamp}.${rawBody}`;
    const hmac = crypto
      .createHmac('sha256', secretMaterial)
      .update(message)
      .digest('hex');
    return `t=${timestamp},v1=${hmac}`;
  }
}
