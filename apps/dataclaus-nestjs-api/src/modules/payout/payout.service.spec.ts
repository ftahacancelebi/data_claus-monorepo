import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayoutService } from './payout.service';
import { PayoutRequest } from './entities/payout-request.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { FinancialTxService } from '../ledger/financial-tx.service';
import { StripeSimulationProvider } from './providers/stripe-simulation.provider';
import { PayoutMethod, PayoutStatus } from '../../common/constants';

describe('PayoutService', () => {
  let service: PayoutService;
  let payoutRepo: jest.Mocked<Repository<PayoutRequest>>;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let financialTx: jest.Mocked<FinancialTxService>;
  let stripeProvider: jest.Mocked<StripeSimulationProvider>;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutService,
        {
          provide: getRepositoryToken(PayoutRequest),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: FinancialTxService,
          useValue: {
            runInTransaction: jest.fn(),
            transferAtomic: jest.fn(),
          },
        },
        {
          provide: StripeSimulationProvider,
          useValue: {
            sendPayout: jest.fn(),
            isSimulated: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get(PayoutService);
    payoutRepo = module.get(getRepositoryToken(PayoutRequest));
    walletRepo = module.get(getRepositoryToken(Wallet));
    financialTx = module.get(FinancialTxService);
    stripeProvider = module.get(StripeSimulationProvider);
  });

  describe('requestPayout validation', () => {
    it('rejects amounts below the threshold', async () => {
      await expect(
        service.requestPayout('user-1', {
          amount: 0.001,
          method: PayoutMethod.BANK_SIMULATION,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when no wallet exists', async () => {
      walletRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.requestPayout('user-1', {
          amount: 1,
          method: PayoutMethod.BANK_SIMULATION,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when wallet balance is insufficient', async () => {
      walletRepo.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        ownerId: 'user-1',
        balance: 0.5,
        pendingBalance: 0,
        currency: 'USD',
      } as any);

      await expect(
        service.requestPayout('user-1', {
          amount: 1,
          method: PayoutMethod.BANK_SIMULATION,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getOne authorization', () => {
    it('forbids access to another user payout', async () => {
      payoutRepo.findOne.mockResolvedValueOnce({
        id: 'p1',
        userId: 'other-user',
      } as any);

      await expect(service.getOne('p1', 'me')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('returns the payout when user owns it', async () => {
      payoutRepo.findOne.mockResolvedValueOnce({
        id: 'p1',
        userId: 'me',
        walletId: 'w1',
        amount: '1.5',
        currency: 'USD',
        method: PayoutMethod.BANK_SIMULATION,
        status: PayoutStatus.REQUESTED,
        requestedAt: new Date(),
        approvedAt: null,
        completedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        metadata: null,
      } as any);

      const result = await service.getOne('p1', 'me');
      expect(result.id).toBe('p1');
      expect(result.amount).toBe(1.5);
    });
  });

  describe('admin actions', () => {
    it('rejects approving a non-existent payout', async () => {
      payoutRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.adminApprove('p1', 'admin')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects approving a non-requested payout', async () => {
      payoutRepo.findOne.mockResolvedValueOnce({
        id: 'p1',
        status: PayoutStatus.COMPLETED,
      } as any);
      await expect(service.adminApprove('p1', 'admin')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(stripeProvider.sendPayout).not.toHaveBeenCalled();
    });
  });
});
