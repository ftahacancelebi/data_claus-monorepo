import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { FinancialTxService } from './financial-tx.service';

describe('FinancialTxService', () => {
  let service: FinancialTxService;
  let qr: any;
  let dataSource: any;

  beforeEach(async () => {
    qr = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {},
    };
    dataSource = {
      createQueryRunner: jest.fn(() => qr),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialTxService,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get(FinancialTxService);
  });

  describe('runInTransaction', () => {
    it('commits when callback succeeds', async () => {
      const result = await service.runInTransaction(async () => 'ok');
      expect(result).toBe('ok');
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('rolls back when callback throws', async () => {
      await expect(
        service.runInTransaction(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });
  });

  describe('transferAtomic input validation', () => {
    it('rejects non-positive amounts', async () => {
      await expect(
        service.transferAtomic(qr as any, {
          sourceWalletId: 'a',
          destWalletId: 'b',
          amount: 0,
        }),
      ).rejects.toThrow(/amount must be positive/);

      await expect(
        service.transferAtomic(qr as any, {
          sourceWalletId: 'a',
          destWalletId: 'b',
          amount: -1,
        }),
      ).rejects.toThrow(/amount must be positive/);
    });

    it('rejects when source equals destination', async () => {
      await expect(
        service.transferAtomic(qr as any, {
          sourceWalletId: 'same',
          destWalletId: 'same',
          amount: 1,
        }),
      ).rejects.toThrow(/source and dest must differ/);
    });
  });
});
