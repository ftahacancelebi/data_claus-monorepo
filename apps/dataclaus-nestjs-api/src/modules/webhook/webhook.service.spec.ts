import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { WebhookService } from './webhook.service';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookSecret } from './entities/webhook-secret.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';

describe('WebhookService', () => {
  let service: WebhookService;
  let endpoints: jest.Mocked<Repository<WebhookEndpoint>>;
  let secrets: jest.Mocked<Repository<WebhookSecret>>;
  let deliveries: jest.Mocked<Repository<WebhookDelivery>>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getRepositoryToken(WebhookEndpoint),
          useValue: {
            create: jest.fn((v) => v),
            save: jest.fn(async (v) => ({ id: 'ep-1', ...v })),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WebhookSecret),
          useValue: {
            create: jest.fn((v) => v),
            save: jest.fn(async (v) => ({
              id: 'sec-1',
              createdAt: new Date(),
              ...v,
            })),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WebhookDelivery),
          useValue: {
            create: jest.fn((v) => v),
            save: jest.fn(async (v) => v),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            })),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(WebhookService);
    endpoints = moduleRef.get(getRepositoryToken(WebhookEndpoint));
    secrets = moduleRef.get(getRepositoryToken(WebhookSecret));
    deliveries = moduleRef.get(getRepositoryToken(WebhookDelivery));
  });

  describe('createEndpoint', () => {
    it('rejects non-http URLs', async () => {
      await expect(
        service.createEndpoint('dev-1', { url: 'ftp://x.example.com' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('persists with default eventTypes []', async () => {
      const result = await service.createEndpoint('dev-1', {
        url: 'https://example.com/hook',
      });
      expect(endpoints.save).toHaveBeenCalled();
      expect(result.eventTypes).toEqual([]);
    });
  });

  describe('createSecret', () => {
    it('returns cleartext only once and stores hash', async () => {
      endpoints.findOne.mockResolvedValueOnce({
        id: 'ep-1',
        developerId: 'dev-1',
      } as WebhookEndpoint);

      const result = await service.createSecret('dev-1', 'ep-1', {
        label: 'rotation-2026',
      });
      expect(result.value).toMatch(/^whsec_[a-f0-9]{48}$/);
      expect(result.prefix).toHaveLength(8);
      const expectedHash = crypto
        .createHash('sha256')
        .update(result.value)
        .digest('hex');
      expect(secrets.save).toHaveBeenCalled();
      const savedArg = (secrets.save as jest.Mock).mock.calls[0][0];
      expect(savedArg.secretHash).toBe(expectedHash);
    });

    it('rejects when endpoint not owned', async () => {
      endpoints.findOne.mockResolvedValueOnce(null);
      await expect(
        service.createSecret('dev-1', 'ep-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('enqueueDelivery', () => {
    it('matches endpoints subscribed to event type', async () => {
      endpoints.find.mockResolvedValueOnce([
        {
          id: 'ep-1',
          eventTypes: ['wallet.credited'],
          enabled: true,
        } as unknown as WebhookEndpoint,
        {
          id: 'ep-2',
          eventTypes: ['payout.completed'],
          enabled: true,
        } as unknown as WebhookEndpoint,
        {
          id: 'ep-3',
          eventTypes: [],
          enabled: true,
        } as unknown as WebhookEndpoint,
      ]);

      const result = await service.enqueueDelivery({
        eventType: 'wallet.credited',
        payload: { ok: true },
      });
      // ep-1 (explicit) + ep-3 (empty array = all) → 2 deliveries
      expect(result).toHaveLength(2);
    });

    it('ignores disabled endpoints', async () => {
      endpoints.find.mockResolvedValueOnce([]);
      const result = await service.enqueueDelivery({
        eventType: 'wallet.credited',
        payload: {},
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('signPayload', () => {
    it('produces deterministic Stripe-style signature', () => {
      const sig = WebhookService.signPayload('secret', 'body', 1700000000);
      const parts = sig.split(',');
      expect(parts[0]).toBe('t=1700000000');
      expect(parts[1]).toMatch(/^v1=[a-f0-9]{64}$/);
    });

    it('different secret produces different signature', () => {
      const a = WebhookService.signPayload('secret-a', 'body', 1);
      const b = WebhookService.signPayload('secret-b', 'body', 1);
      expect(a).not.toBe(b);
    });
  });
});
