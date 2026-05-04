import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LedgerInvariantService } from './ledger-invariant.service';

describe('LedgerInvariantService', () => {
  let service: LedgerInvariantService;
  let dataSourceQuery: jest.Mock;
  let eventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    dataSourceQuery = jest.fn();
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerInvariantService,
        {
          provide: getDataSourceToken(),
          useValue: { query: dataSourceQuery },
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    service = module.get(LedgerInvariantService);
  });

  it('reports ok when net is 0 and no orphans', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      { net: '0.00000000', rows: '24', orphans: '0' },
    ]);

    const result = await service.verify();
    expect(result.ok).toBe(true);
    expect(result.net).toBe(0);
    expect(result.totalRows).toBe(24);
    expect(result.orphans).toBe(0);
  });

  it('reports broken when net != 0', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      { net: '0.42000000', rows: '24', orphans: '0' },
    ]);

    const result = await service.verify();
    expect(result.ok).toBe(false);
    expect(result.net).toBeCloseTo(0.42, 6);
  });

  it('reports broken when orphan rows exist', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      { net: '0', rows: '10', orphans: '2' },
    ]);

    const result = await service.verify();
    expect(result.ok).toBe(false);
    expect(result.orphans).toBe(2);
  });

  it('runScheduled emits ledger.invariant.broken on failure', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      { net: '1.00000000', rows: '5', orphans: '1' },
    ]);

    await service.runScheduled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'ledger.invariant.broken',
      expect.objectContaining({ ok: false }),
    );
  });

  it('runScheduled does not emit on success', async () => {
    dataSourceQuery.mockResolvedValueOnce([
      { net: '0', rows: '3', orphans: '0' },
    ]);

    await service.runScheduled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
