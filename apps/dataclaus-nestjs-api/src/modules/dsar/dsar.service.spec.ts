import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DsarService } from './dsar.service';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { ScoredEvent } from '../ingest/entities/scored-event.entity';
import { LedgerTransaction } from '../ledger/entities';
import { Wallet } from '../wallet/entities';
import { PayoutRequest } from '../payout/entities/payout-request.entity';
import { AuditService } from '../audit/audit.service';

describe('DsarService', () => {
  let service: DsarService;
  let users: jest.Mocked<Repository<DataClausUser>>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DsarService,
        {
          provide: getRepositoryToken(DataClausUser),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(async (v) => v),
            delete: jest.fn(async () => undefined),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ScoredEvent),
          useValue: { find: jest.fn(async () => []) },
        },
        {
          provide: getRepositoryToken(LedgerTransaction),
          useValue: { find: jest.fn(async () => []) },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: { findOne: jest.fn(async () => null) },
        },
        {
          provide: getRepositoryToken(PayoutRequest),
          useValue: { find: jest.fn(async () => []) },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn(async () => undefined) },
        },
      ],
    }).compile();

    service = moduleRef.get(DsarService);
    users = moduleRef.get(getRepositoryToken(DataClausUser));
  });

  describe('exportUserData', () => {
    it('throws when user not found', async () => {
      users.findOne.mockResolvedValueOnce(null);
      await expect(service.exportUserData('u-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('strips passwordHash from the export payload', async () => {
      users.findOne.mockResolvedValueOnce({
        id: 'u-1',
        email: 'a@b.c',
        passwordHash: 'super-secret',
      } as unknown as DataClausUser);

      const result = await service.exportUserData('u-1');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.email).toBe('a@b.c');
    });
  });

  describe('requestDeletion', () => {
    it('schedules deletion 30 days out', async () => {
      const baseUser = {
        id: 'u-1',
        deletionRequestedAt: null,
        deleteAfter: null,
      };
      users.findOne.mockResolvedValueOnce(baseUser as unknown as DataClausUser);

      const result = await service.requestDeletion('u-1');
      const expected = Date.now() + 30 * 24 * 60 * 60 * 1000;
      expect(
        Math.abs(result.deleteAfter.getTime() - expected),
      ).toBeLessThan(2_000);
    });

    it('rejects when a deletion is already pending', async () => {
      users.findOne.mockResolvedValueOnce({
        id: 'u-1',
        deletionRequestedAt: new Date(),
        deleteAfter: new Date(Date.now() + 1_000_000),
      } as unknown as DataClausUser);

      await expect(service.requestDeletion('u-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('cancelDeletion', () => {
    it('clears deletion fields', async () => {
      const user = {
        id: 'u-1',
        deletionRequestedAt: new Date(),
        deleteAfter: new Date(Date.now() + 1_000_000),
      } as unknown as DataClausUser;
      users.findOne.mockResolvedValueOnce(user);

      await service.cancelDeletion('u-1');
      expect(user.deletionRequestedAt).toBeNull();
      expect(user.deleteAfter).toBeNull();
    });

    it('is a no-op when no deletion is pending', async () => {
      users.findOne.mockResolvedValueOnce({
        id: 'u-1',
        deletionRequestedAt: null,
      } as unknown as DataClausUser);
      await expect(service.cancelDeletion('u-1')).resolves.toBeUndefined();
    });
  });
});
