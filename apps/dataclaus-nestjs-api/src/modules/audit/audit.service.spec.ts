import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn((v) => v),
            save: jest.fn(async (v) => ({ id: 'log-1', ...v })),
            findAndCount: jest.fn(),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(AuditService);
    repo = moduleRef.get(getRepositoryToken(AuditLog));
  });

  it('persists an audit row', async () => {
    await service.record({
      actorType: 'developer',
      actorId: 'dev-1',
      action: 'developer.api_key.rotated',
      targetId: 'key-1',
      ipAddress: '1.2.3.4',
    });
    expect(repo.save).toHaveBeenCalled();
  });

  it('swallows persistence errors so caller is unaffected', async () => {
    repo.save.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.record({
        actorType: 'developer',
        actorId: 'dev-1',
        action: 'x',
      }),
    ).resolves.toBeUndefined();
  });

  it('CSV export escapes commas and quotes', async () => {
    repo.findAndCount.mockResolvedValueOnce([
      [
        {
          createdAt: new Date('2026-04-29T12:00:00Z'),
          actorType: 'admin',
          actorId: 'a-1',
          action: 'foo,bar',
          targetType: 'x',
          targetId: 't',
          status: 200,
          ipAddress: null,
          errorMessage: 'has "quotes"',
        } as AuditLog,
      ],
      1,
    ]);
    const csv = await service.exportCsv({});
    const lines = csv.split('\n');
    expect(lines[0]).toContain('createdAt,actorType');
    expect(lines[1]).toContain('"foo,bar"');
    expect(lines[1]).toContain('"has ""quotes"""');
  });
});
