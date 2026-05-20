import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApplicationExtractorService } from './application-extractor.service';
import { Application } from '../../application/entities/application.entity';

const FAKE_APP_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const FAKE_DEV_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const FAKE_USER_ID = 'cccccccc-0000-0000-0000-000000000001';

const mockApp = {
  id: FAKE_APP_ID,
  developerId: FAKE_DEV_ID,
  name: 'TestApp',
  category: 'social',
  description: null,
  websiteUrl: null,
  isActive: true,
  totalEvents: 0,
  totalUsers: 0,
  totalRevenue: 0,
  qualityScore: 0,
  lastEventAt: null,
  userSharePercent: 70,
  developer: null as never,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Application;

function makeDataSource(aggRow: object, highRows: object[] = [], lowRows: object[] = [], distRows: object[] = []) {
  let callCount = 0;
  return {
    query: jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve([aggRow]);          // aggregate
      if (callCount === 2) return Promise.resolve(distRows);          // event_type distribution
      if (callCount === 3) return Promise.resolve(highRows);          // high quality sample
      if (callCount === 4) return Promise.resolve(lowRows);           // low quality sample
      return Promise.resolve([]);
    }),
  };
}

describe('ApplicationExtractorService', () => {
  let service: ApplicationExtractorService;
  let mockAppRepo: { findOne: jest.Mock };
  let mockDataSource: { query: jest.Mock };

  async function build(aggRow: object, highRows: object[] = [], lowRows: object[] = [], distRows: object[] = []) {
    mockAppRepo = { findOne: jest.fn().mockResolvedValue(mockApp) };
    mockDataSource = makeDataSource(aggRow, highRows, lowRows, distRows);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationExtractorService,
        { provide: getRepositoryToken(Application), useValue: mockAppRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(ApplicationExtractorService);
  }

  describe('anonymizeUserId', () => {
    it('returns u_ prefix + 8 hex chars', async () => {
      await build({ row_count: '200', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' });
      const result = service.anonymizeUserId(FAKE_USER_ID, FAKE_APP_ID);
      expect(result).toMatch(/^u_[0-9a-f]{8}$/);
    });

    it('is deterministic for the same (userId, appId) pair', async () => {
      await build({ row_count: '200', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' });
      const a = service.anonymizeUserId(FAKE_USER_ID, FAKE_APP_ID);
      const b = service.anonymizeUserId(FAKE_USER_ID, FAKE_APP_ID);
      expect(a).toBe(b);
    });

    it('differs for different apps with the same user', async () => {
      await build({ row_count: '200', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' });
      const appB = 'dddddddd-0000-0000-0000-000000000001';
      const a = service.anonymizeUserId(FAKE_USER_ID, FAKE_APP_ID);
      const b = service.anonymizeUserId(FAKE_USER_ID, appB);
      expect(a).not.toBe(b);
    });
  });

  describe('suggestCategory', () => {
    it('maps dominant accelerometer events to fitness', async () => {
      await build({ row_count: '200', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' });
      const result = service.suggestCategory({ accelerometer: 80, gyroscope: 60, scroll: 5 }, null);
      expect(result).toBe('fitness');
    });

    it('falls back to appCategory when no events match known types', async () => {
      await build({ row_count: '200', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' });
      const result = service.suggestCategory({ unknown_event: 100 }, 'finance');
      expect(result).toBe('finance');
    });

    it('falls back to "other" when no match and no appCategory', async () => {
      await build({ row_count: '200', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' });
      const result = service.suggestCategory({ unknown_event: 100 }, null);
      expect(result).toBe('other');
    });
  });

  describe('extract', () => {
    it('throws NotFoundException when app does not exist', async () => {
      await build({ row_count: '200', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' });
      mockAppRepo.findOne.mockResolvedValue(null);
      await expect(service.extract(FAKE_APP_ID, FAKE_DEV_ID, 'developer')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when developer does not own app', async () => {
      await build({ row_count: '200', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' });
      await expect(service.extract(FAKE_APP_ID, 'other-dev-id', 'developer')).rejects.toThrow(ForbiddenException);
    });

    it('does NOT throw for admin accessing another dev app', async () => {
      await build(
        { row_count: '200', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' },
        [{ user_id: FAKE_USER_ID, event_type: 'scroll', quality_score: '0.85', session_id: null, ingested_at: '2025-01-10T00:00:00Z' }],
        [],
        [{ event_type: 'scroll', type_count: '200' }],
      );
      await expect(service.extract(FAKE_APP_ID, 'other-dev-id', 'admin')).resolves.toBeDefined();
    });

    it('throws BadRequestException when row_count < 100', async () => {
      await build({ row_count: '50', unique_users: '10', min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-31T00:00:00Z' });
      await expect(service.extract(FAKE_APP_ID, FAKE_DEV_ID, 'developer')).rejects.toThrow(BadRequestException);
    });

    it('returns a draft with anonymized user_pseudo_id in sample rows', async () => {
      const highRows = [
        { user_id: FAKE_USER_ID, event_type: 'accelerometer', quality_score: '0.91', session_id: 's1', ingested_at: '2025-10-04T07:14:21Z' },
        { user_id: FAKE_USER_ID, event_type: 'gyroscope', quality_score: '0.88', session_id: 's1', ingested_at: '2025-10-04T07:14:25Z' },
      ];
      await build(
        { row_count: '1200', unique_users: '100', min_date: '2025-10-01T00:00:00Z', max_date: '2025-10-31T00:00:00Z' },
        highRows,
        [],
        [{ event_type: 'accelerometer', type_count: '800' }, { event_type: 'gyroscope', type_count: '400' }],
      );
      const draft = await service.extract(FAKE_APP_ID, FAKE_DEV_ID, 'developer');
      expect(draft.sample_rows[0]).toHaveProperty('user_pseudo_id');
      expect(draft.sample_rows[0]).not.toHaveProperty('user_id');
      expect(draft.category).toBe('fitness');
      expect(draft.claimed_metrics.row_count).toBe(1200);
    });
  });
});
