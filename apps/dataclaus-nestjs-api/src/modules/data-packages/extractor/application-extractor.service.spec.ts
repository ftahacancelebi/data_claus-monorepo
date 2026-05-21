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

    it('emits a device-only dimensions map for apps not declared in APP_DIMENSIONS', async () => {
      const highRows = [
        { user_id: FAKE_USER_ID, event_type: 'scroll', quality_score: '0.85', session_id: 's1', ingested_at: '2025-10-04T07:14:21Z' },
      ];
      await build(
        { row_count: '500', unique_users: '50', min_date: '2025-10-01T00:00:00Z', max_date: '2025-10-31T00:00:00Z' },
        highRows,
        [],
        [{ event_type: 'scroll', type_count: '500' }],
      );
      const draft = await service.extract(FAKE_APP_ID, FAKE_DEV_ID, 'developer');
      expect(draft.dimensions).toBeDefined();
      expect(draft.dimensions!.device).toBeDefined();
      expect(draft.dimensions!.device!.count).toBe(500);
      expect(draft.dimensions!.behavior).toBeUndefined();
      expect(draft.dimensions!.demographic).toBeUndefined();
    });
  });

  describe('dimensions', () => {
    const TIKTOK_APP_ID = 'eeeeeeee-0000-0000-0000-000000000001';

    function makeMultiDimDataSource(opts: {
      aggRow: object;
      distRows: object[];
      highRows: object[];
      lowRows: object[];
      behaviorCount: string;
      watchRows: object[];
      profileRows: object[];
    }) {
      // SQL-pattern-based routing so the assertion is robust to call order
      // (e.g. when behaviorCount=0 the rows query is skipped).
      return {
        query: jest.fn().mockImplementation((sql: string) => {
          const s = sql.toLowerCase();
          if (s.includes('from scored_events') && s.includes('count(*)') && s.includes('min(')) {
            return Promise.resolve([opts.aggRow]);
          }
          if (s.includes('from scored_events') && s.includes('group by event_type')) {
            return Promise.resolve(opts.distRows);
          }
          if (s.includes('from scored_events') && s.includes('quality_score >= 0.6')) {
            return Promise.resolve(opts.highRows);
          }
          if (s.includes('from scored_events') && s.includes('quality_score < 0.6')) {
            return Promise.resolve(opts.lowRows);
          }
          if (s.includes('from watch_events') && s.includes('count(*)')) {
            return Promise.resolve([{ count: opts.behaviorCount }]);
          }
          if (s.includes('from watch_events') && s.includes('video_id')) {
            return Promise.resolve(opts.watchRows);
          }
          if (s.includes('from user_profiles')) {
            return Promise.resolve(opts.profileRows);
          }
          return Promise.resolve([]);
        }),
      };
    }

    async function buildTikTok(opts: Parameters<typeof makeMultiDimDataSource>[0]) {
      mockAppRepo = {
        findOne: jest.fn().mockResolvedValue({
          ...mockApp,
          id: TIKTOK_APP_ID,
          name: 'TikTok Clone',
          category: 'social',
        }),
      };
      mockDataSource = makeMultiDimDataSource(opts);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ApplicationExtractorService,
          { provide: getRepositoryToken(Application), useValue: mockAppRepo },
          { provide: DataSource, useValue: mockDataSource },
        ],
      }).compile();

      service = module.get(ApplicationExtractorService);
    }

    it('assembles behavior + demographic + device dimensions for TikTok Clone', async () => {
      const watchRows = [
        { user_id: 'u1', video_id: 'v1', video_tags: ['dance'], video_category: 'dance', dwell_ms: 12000, completed: true,  recorded_at: new Date('2025-10-04T07:14:21Z') },
        { user_id: 'u2', video_id: 'v2', video_tags: ['dance', 'music'], video_category: 'dance', dwell_ms: 8000,  completed: true,  recorded_at: new Date('2025-10-04T07:15:00Z') },
        { user_id: 'u3', video_id: 'v3', video_tags: ['comedy'], video_category: 'comedy', dwell_ms: 1500,  completed: false, recorded_at: new Date('2025-10-04T07:16:00Z') },
        { user_id: 'u4', video_id: 'v4', video_tags: ['dance'], video_category: 'dance', dwell_ms: 7000,  completed: true,  recorded_at: new Date('2025-10-04T07:17:00Z') },
        { user_id: 'u5', video_id: 'v5', video_tags: ['gaming'], video_category: 'gaming', dwell_ms: 9000,  completed: false, recorded_at: new Date('2025-10-04T07:18:00Z') },
      ];
      const profileRows = [
        { user_id: 'u1', age_bucket: '18-24', gender: 'f', locale: 'en-US' },
        { user_id: 'u2', age_bucket: '25-34', gender: 'm', locale: 'tr-TR' },
      ];

      await buildTikTok({
        aggRow: { row_count: '500', unique_users: '50', min_date: '2025-10-01T00:00:00Z', max_date: '2025-10-31T00:00:00Z' },
        distRows: [{ event_type: 'scroll', type_count: '500' }],
        highRows: [{ user_id: FAKE_USER_ID, event_type: 'scroll', quality_score: '0.85', session_id: 's1', ingested_at: '2025-10-04T07:14:21Z' }],
        lowRows: [],
        behaviorCount: '5',
        watchRows,
        profileRows,
      });

      const draft = await service.extract(TIKTOK_APP_ID, FAKE_DEV_ID, 'developer');

      expect(draft.dimensions).toBeDefined();
      expect(draft.dimensions!.device).toBeDefined();
      expect(draft.dimensions!.device!.count).toBe(500);

      expect(draft.dimensions!.behavior).toBeDefined();
      expect(draft.dimensions!.behavior!.count).toBe(5);
      expect(draft.dimensions!.behavior!.distribution!.dance).toBeGreaterThan(0);
      expect(draft.dimensions!.behavior!.distribution!.dance).toBe(3);

      expect(draft.dimensions!.demographic).toBeDefined();
      expect(draft.dimensions!.demographic!.count).toBe(2);

      // Backward-compat flat fields still present
      expect(draft.sample_rows).toBeDefined();
      expect(draft.claimed_metrics.row_count).toBe(500);
    });

    it('omits behavior when watch_events count is zero', async () => {
      await buildTikTok({
        aggRow: { row_count: '500', unique_users: '50', min_date: '2025-10-01T00:00:00Z', max_date: '2025-10-31T00:00:00Z' },
        distRows: [{ event_type: 'scroll', type_count: '500' }],
        highRows: [{ user_id: FAKE_USER_ID, event_type: 'scroll', quality_score: '0.85', session_id: 's1', ingested_at: '2025-10-04T07:14:21Z' }],
        lowRows: [],
        behaviorCount: '0',
        watchRows: [],
        profileRows: [],
      });

      const draft = await service.extract(TIKTOK_APP_ID, FAKE_DEV_ID, 'developer');
      expect(draft.dimensions!.behavior).toBeUndefined();
      expect(draft.dimensions!.demographic).toBeUndefined();
      expect(draft.dimensions!.device).toBeDefined();
    });
  });
});
