# Data Marketplace Auto-Extract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "✨ From an app" 2-step modal that aggregates `scored_events` from a developer's existing app into a ready-to-submit data package draft, wired to the existing `POST /v1/packages` evaluation flow.

**Architecture:** New `extractor` sub-module inside `data-packages` provides two read-only endpoints (`eligible-apps`, `preview/:appId`) backed by raw SQL aggregation over `scored_events`. The frontend 2-step modal calls these, holds the draft in component state, and submits via the unchanged `useCreatePackage` hook. No existing endpoints modified.

**Tech Stack:** NestJS + TypeORM (raw SQL via DataSource) / Next.js 14 App Router + TanStack Query 5 + zod 4 + phosphor-react icons / Jest for backend unit tests

---

## File Map

**Create:**
- `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/extractor.constants.ts`
- `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/eligible-application.dto.ts`
- `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/extract-preview.dto.ts`
- `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.ts`
- `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.spec.ts`
- `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/extractor.controller.ts`
- `apps/dataclaus-web/src/components/packages/CreateFromAppModal.tsx`

**Modify:**
- `apps/dataclaus-nestjs-api/src/modules/data-packages/data-packages.module.ts` (add extractor providers + ScoredEvent/Application entities)
- `apps/dataclaus-nestjs-api/src/modules/data-packages/package-evaluator.prompt.ts` (add 1 pseudonymization note line)
- `scripts/demo-seed.ts` (bump scored_events to 3k, synthetic user UUIDs, bulk insert)
- `apps/dataclaus-web/src/lib/schemas.ts` (add EligibleApplicationSchema, ExtractedPackageDraftSchema)
- `apps/dataclaus-web/src/lib/query-keys.ts` (add packages.extract key group)
- `apps/dataclaus-web/src/lib/api.ts` (add listEligibleApplications, extractPackagePreview)
- `apps/dataclaus-web/src/lib/api-hooks.ts` (add useEligibleApplications, useExtractPreview)
- `apps/dataclaus-web/src/app/dashboard/packages/page.tsx` (replace button with dropdown trigger)
- `JURY_LOGIN.md` (update submission instructions)

---

## Task 1: Extractor constants & DTOs

**Files:**
- Create: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/extractor.constants.ts`
- Create: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/eligible-application.dto.ts`
- Create: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/extract-preview.dto.ts`

- [ ] **Create the extractor directory and constants file**

```bash
mkdir -p apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto
```

Content of `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/extractor.constants.ts`:

```typescript
export const PRICE_BASELINE_USD_PER_ROW: Record<string, number> = {
  fitness:       0.0008,
  social:        0.0003,
  finance:       0.0050,
  entertainment: 0.0004,
  health:        0.0012,
  location:      0.0006,
  productivity:  0.0005,
  other:         0.0004,
};

export const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  accelerometer: 'fitness',
  gyroscope:     'fitness',
  scroll:        'social',
  screen_view:   'social',
  touch:         'entertainment',
};

export const EXTRACT_MIN_ROWS = 100;
export const EXTRACT_MIN_UNIQUE_USERS = 5;
export const EXTRACT_DEFAULT_RANGE_DAYS = 30;
export const EXTRACT_SAMPLE_HIGH_QUALITY = 6;   // quality_score >= 0.6
export const EXTRACT_SAMPLE_LOW_QUALITY = 2;    // quality_score <  0.6
```

- [ ] **Create EligibleApplicationDto**

Content of `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/eligible-application.dto.ts`:

```typescript
export class EligibleApplicationDto {
  id: string;
  name: string;
  category: string | null;
  event_count: number;
  unique_users: number;
  eligible: boolean;
  reason?: string;
}
```

- [ ] **Create ExtractedPackageDraftDto**

Content of `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/extract-preview.dto.ts`:

```typescript
export class ExtractedPackageDraftDto {
  // These map 1:1 to CreatePackageDto — submit directly to POST /v1/packages
  title: string;
  category: string;
  claimed_metrics: {
    row_count: number;
    unique_users: number;
    date_range_start: string;
    date_range_end: string;
  };
  schema_json: Record<string, string>;
  sample_rows: Array<Record<string, unknown>>;
  price: number;
  application_id: string;

  // UI-only metadata — ignored by POST /v1/packages
  ui_meta: {
    application_name: string;
    suggested_price_basis: string;
    flagged_sample_count: number;
    coverage_warning?: string;
  };
}
```

- [ ] **Verify files exist**

```bash
ls apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/
ls apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/
```

Expected output: `extractor.constants.ts` and `dto/` with two files inside.

- [ ] **Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/
git commit -m "feat(extractor): add constants and DTOs for auto-extract endpoints"
```

---

## Task 2: ApplicationExtractorService

**Files:**
- Create: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.ts`
- Create: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.spec.ts`

- [ ] **Write the failing unit tests first**

Content of `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApplicationExtractorService } from './application-extractor.service';
import { Application } from '../../application/entities/application.entity';

const FAKE_APP_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const FAKE_DEV_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const FAKE_USER_ID = 'cccccccc-0000-0000-0000-000000000001';

const mockApp: Application = {
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
};

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
```

- [ ] **Run tests to confirm they fail (service doesn't exist yet)**

```bash
cd apps/dataclaus-nestjs-api && pnpm test -- --testPathPattern=application-extractor
```

Expected: `FAIL` with "Cannot find module './application-extractor.service'"

- [ ] **Implement ApplicationExtractorService**

Content of `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.ts`:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Application } from '../../application/entities/application.entity';
import {
  EXTRACT_DEFAULT_RANGE_DAYS,
  EXTRACT_MIN_ROWS,
  EXTRACT_MIN_UNIQUE_USERS,
  EXTRACT_SAMPLE_HIGH_QUALITY,
  EXTRACT_SAMPLE_LOW_QUALITY,
  EVENT_TYPE_TO_CATEGORY,
  PRICE_BASELINE_USD_PER_ROW,
} from './extractor.constants';
import { EligibleApplicationDto } from './dto/eligible-application.dto';
import { ExtractedPackageDraftDto } from './dto/extract-preview.dto';

interface AggRow {
  row_count: string;
  unique_users: string;
  min_date: string;
  max_date: string;
}

interface DistRow {
  event_type: string;
  type_count: string;
}

interface SampleRow {
  user_id: string;
  event_type: string;
  quality_score: string;
  session_id: string | null;
  ingested_at: string;
}

const SCHEMA_JSON: Record<string, string> = {
  user_pseudo_id:  'string',
  event_type:      'string',
  sensor_class:    'string',
  quality_score:   'number',
  session_id:      'string',
  recorded_at:     'timestamp',
};

@Injectable()
export class ApplicationExtractorService {
  constructor(
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // --------------------------------------------------------------------------
  // Public: list eligible apps for a developer
  // --------------------------------------------------------------------------

  async listEligible(developerId: string): Promise<EligibleApplicationDto[]> {
    const apps = await this.appRepo.find({ where: { developerId } });
    const results: EligibleApplicationDto[] = [];
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const app of apps) {
      const [agg] = await this.dataSource.query<AggRow[]>(
        `SELECT COUNT(*) AS row_count, COUNT(DISTINCT user_id) AS unique_users
         FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3`,
        [app.id, from, now],
      );
      const rowCount = parseInt(agg?.row_count ?? '0', 10);
      const uniqueUsers = parseInt(agg?.unique_users ?? '0', 10);
      const eligible = rowCount >= EXTRACT_MIN_ROWS && uniqueUsers >= EXTRACT_MIN_UNIQUE_USERS;
      results.push({
        id: app.id,
        name: app.name,
        category: app.category ?? null,
        event_count: rowCount,
        unique_users: uniqueUsers,
        eligible,
        reason: eligible
          ? undefined
          : rowCount < EXTRACT_MIN_ROWS
          ? `Needs at least ${EXTRACT_MIN_ROWS} events to package (has ${rowCount})`
          : `Needs at least ${EXTRACT_MIN_UNIQUE_USERS} unique users (has ${uniqueUsers})`,
      });
    }
    return results;
  }

  // --------------------------------------------------------------------------
  // Public: extract preview draft from a single app
  // --------------------------------------------------------------------------

  async extract(
    appId: string,
    requesterId: string,
    requesterRole: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<ExtractedPackageDraftDto> {
    const app = await this.appRepo.findOne({ where: { id: appId } });
    if (!app) throw new NotFoundException('Application not found');
    if (requesterRole !== 'admin' && app.developerId !== requesterId) {
      throw new ForbiddenException('You do not own this application');
    }

    const to = dateRange?.to ?? new Date();
    const from = dateRange?.from ?? new Date(to.getTime() - EXTRACT_DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

    // Aggregate metrics
    const [agg] = await this.dataSource.query<AggRow[]>(
      `SELECT COUNT(*) AS row_count, COUNT(DISTINCT user_id) AS unique_users,
              MIN(ingested_at) AS min_date, MAX(ingested_at) AS max_date
       FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3`,
      [appId, from, to],
    );
    const rowCount = parseInt(agg?.row_count ?? '0', 10);
    const uniqueUsers = parseInt(agg?.unique_users ?? '0', 10);

    if (rowCount < EXTRACT_MIN_ROWS) {
      throw new BadRequestException(
        `Not enough events to package — needs ${EXTRACT_MIN_ROWS}, found ${rowCount}`,
      );
    }
    if (uniqueUsers < EXTRACT_MIN_UNIQUE_USERS) {
      throw new BadRequestException(
        `Not enough unique users — needs ${EXTRACT_MIN_UNIQUE_USERS}, found ${uniqueUsers}`,
      );
    }

    // Event type distribution for category suggestion
    const distRows = await this.dataSource.query<DistRow[]>(
      `SELECT event_type, COUNT(*) AS type_count
       FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3
       GROUP BY event_type`,
      [appId, from, to],
    );
    const distMap: Record<string, number> = {};
    for (const row of distRows) {
      distMap[row.event_type] = parseInt(row.type_count, 10);
    }

    // Stratified sample
    const highQuality = await this.dataSource.query<SampleRow[]>(
      `SELECT user_id, event_type, quality_score, session_id, ingested_at
       FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3
       AND quality_score >= 0.6 ORDER BY RANDOM() LIMIT $4`,
      [appId, from, to, EXTRACT_SAMPLE_HIGH_QUALITY],
    );
    const lowQuality = await this.dataSource.query<SampleRow[]>(
      `SELECT user_id, event_type, quality_score, session_id, ingested_at
       FROM scored_events WHERE application_id = $1 AND ingested_at BETWEEN $2 AND $3
       AND quality_score < 0.6 ORDER BY RANDOM() LIMIT $5`,
      [appId, from, to, EXTRACT_SAMPLE_LOW_QUALITY],
    );
    const allSamples = [...highQuality, ...lowQuality].sort(() => Math.random() - 0.5);
    const sampleRows = this.anonymizeSamples(allSamples, appId);

    const flaggedCount = allSamples.filter(r => parseFloat(r.quality_score) < 0.3).length;
    const category = this.suggestCategory(distMap, app.category ?? null);
    const price = this.suggestPrice(rowCount, category);
    const quarter = `Q${Math.ceil((to.getMonth() + 1) / 3)} ${to.getFullYear()}`;
    const title = `${app.name} ${this.capitalize(category)} Telemetry ${quarter}`;

    return {
      title,
      category,
      claimed_metrics: {
        row_count: rowCount,
        unique_users: uniqueUsers,
        date_range_start: agg.min_date?.split('T')[0] ?? from.toISOString().split('T')[0],
        date_range_end: agg.max_date?.split('T')[0] ?? to.toISOString().split('T')[0],
      },
      schema_json: SCHEMA_JSON,
      sample_rows: sampleRows,
      price,
      application_id: appId,
      ui_meta: {
        application_name: app.name,
        suggested_price_basis: `${category} baseline × ${rowCount.toLocaleString()} rows`,
        flagged_sample_count: flaggedCount,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Helpers — exposed as public for unit testing
  // --------------------------------------------------------------------------

  anonymizeUserId(userId: string, appId: string): string {
    const hash = crypto.createHash('sha256').update(userId + appId).digest('hex');
    return `u_${hash.slice(0, 8)}`;
  }

  suggestCategory(distMap: Record<string, number>, appCategory: string | null): string {
    let maxCount = 0;
    let best: string | null = null;
    for (const [eventType, count] of Object.entries(distMap)) {
      const cat = EVENT_TYPE_TO_CATEGORY[eventType];
      if (cat && count > maxCount) {
        maxCount = count;
        best = cat;
      }
    }
    return best ?? appCategory ?? 'other';
  }

  private suggestPrice(rowCount: number, category: string): number {
    const baseline = PRICE_BASELINE_USD_PER_ROW[category] ?? 0.0004;
    return Math.round(rowCount * baseline * 100) / 100;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private anonymizeSamples(rows: SampleRow[], appId: string): Array<Record<string, unknown>> {
    return rows.map(r => ({
      user_pseudo_id: this.anonymizeUserId(r.user_id, appId),
      event_type:     r.event_type,
      sensor_class:   this.sensorClass(r.event_type),
      quality_score:  parseFloat(parseFloat(r.quality_score).toFixed(4)),
      session_id:     r.session_id ? `s_${crypto.createHash('sha256').update(r.session_id + appId).digest('hex').slice(0, 6)}` : null,
      recorded_at:    r.ingested_at,
    }));
  }

  private sensorClass(eventType: string): string {
    const MAP: Record<string, string> = {
      accelerometer: 'motion',
      gyroscope:     'motion',
      scroll:        'interaction',
      screen_view:   'navigation',
      touch:         'interaction',
    };
    return MAP[eventType] ?? 'other';
  }
}
```

- [ ] **Run tests again — all should pass**

```bash
cd apps/dataclaus-nestjs-api && pnpm test -- --testPathPattern=application-extractor
```

Expected: `PASS` with all 8 tests green.

- [ ] **Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/
git commit -m "feat(extractor): ApplicationExtractorService with aggregate + stratified sample"
```

---

## Task 3: ExtractorController + Module wiring

**Files:**
- Create: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/extractor.controller.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/data-packages.module.ts`

- [ ] **Create ExtractorController**

Content of `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/extractor.controller.ts`:

```typescript
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ApplicationExtractorService } from './application-extractor.service';

@ApiTags('Packages')
@Controller('v1/packages/extract')
@ApiBearerAuth()
export class ExtractorController {
  constructor(private readonly extractor: ApplicationExtractorService) {}

  @Get('eligible-apps')
  @UseGuards(RolesGuard)
  @Roles(Role.DEVELOPER, Role.ADMIN)
  @ApiOperation({ summary: 'List developer apps eligible for auto-packaging (≥100 events, ≥5 users)' })
  async listEligible(@CurrentUser() user: CurrentUserData) {
    return this.extractor.listEligible(user.id);
  }

  @Get('preview/:appId')
  @UseGuards(RolesGuard)
  @Roles(Role.DEVELOPER, Role.ADMIN)
  @ApiOperation({ summary: 'Generate a package draft from an app\'s scored_events (read-only, no side-effects)' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string (default: 30d ago)' })
  @ApiQuery({ name: 'to',   required: false, description: 'ISO date string (default: now)' })
  async preview(
    @Param('appId', new ParseUUIDPipe()) appId: string,
    @CurrentUser() user: CurrentUserData,
    @Query('from') fromStr?: string,
    @Query('to')   toStr?: string,
  ) {
    let dateRange: { from: Date; to: Date } | undefined;
    if (fromStr || toStr) {
      const from = fromStr ? new Date(fromStr) : undefined;
      const to   = toStr   ? new Date(toStr)   : undefined;
      if (from && isNaN(from.getTime())) throw new BadRequestException('Invalid "from" date');
      if (to   && isNaN(to.getTime()))   throw new BadRequestException('Invalid "to" date');
      if (from && to && from > to)        throw new BadRequestException('"from" must be before "to"');
      dateRange = { from: from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to: to ?? new Date() };
    }
    return this.extractor.extract(appId, user.id, user.role, dateRange);
  }
}
```

- [ ] **Wire into DataPackagesModule — replace the entire file**

Replace `apps/dataclaus-nestjs-api/src/modules/data-packages/data-packages.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from '../wallet/entities';
import { LedgerModule } from '../ledger/ledger.module';
import { Application } from '../application/entities/application.entity';
import { ScoredEvent } from '../ingest/entities/scored-event.entity';
import { DataPackage } from './entities/data-package.entity';
import { PackagePurchase } from './entities/package-purchase.entity';
import { DataPackagesController } from './data-packages.controller';
import { DataPackagesService } from './data-packages.service';
import { PackageEvaluatorService } from './package-evaluator.service';
import { ApplicationExtractorService } from './extractor/application-extractor.service';
import { ExtractorController } from './extractor/extractor.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataPackage, PackagePurchase, Wallet, Application, ScoredEvent]),
    LedgerModule,
  ],
  controllers: [DataPackagesController, ExtractorController],
  providers: [DataPackagesService, PackageEvaluatorService, ApplicationExtractorService],
  exports: [DataPackagesService],
})
export class DataPackagesModule {}
```

- [ ] **Build the backend to verify no compile errors**

```bash
cd apps/dataclaus-nestjs-api && pnpm run build
```

Expected: `Build complete` with no TypeScript errors.

- [ ] **Manual smoke — start the API and test the two endpoints**

In one terminal:
```bash
pnpm run dev:api
```

In another, using a valid developer JWT from your session (replace `<TOKEN>`):
```bash
# Should return array of apps with eligible/event_count fields
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/v1/packages/extract/eligible-apps | jq .

# Should return ExtractedPackageDraftDto — replace <APP_ID> with a real app id from JURY_LOGIN.md
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/v1/packages/extract/preview/<APP_ID> | jq .
```

Expected for eligible-apps: JSON array with `id, name, eligible, event_count, unique_users` per app.
Expected for preview: JSON with `title, category, claimed_metrics, schema_json, sample_rows, price, ui_meta`.

- [ ] **Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/
git commit -m "feat(extractor): ExtractorController + DataPackagesModule wired"
```

---

## Task 4: Demo seed update — 3k scored_events with synthetic user UUIDs

**Files:**
- Modify: `scripts/demo-seed.ts`

- [ ] **Find and replace the `seedScoredEvents` function**

Open `scripts/demo-seed.ts`. Find the `seedScoredEvents` function (around line 484) and replace it entirely:

```typescript
async function seedScoredEvents(
  ds: DataSource,
  applications: Application[],
): Promise<number> {
  const repo = ds.getRepository(ScoredEvent);
  const existing = await repo.count();
  if (existing >= 3000) {
    return existing;
  }

  const toInsert = 3000 - existing;

  // 100 deterministic synthetic user UUIDs per seed run — no FK needed on scored_events
  function syntheticUserId(index: number): string {
    const hex = require('crypto')
      .createHash('sha256')
      .update(`demo-synthetic-user-${index}`)
      .digest('hex')
      .slice(0, 32);
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  }
  const syntheticUsers = Array.from({ length: 100 }, (_, i) => syntheticUserId(i));

  const eventTypes = ['accelerometer', 'gyroscope', 'touch', 'scroll', 'screen_view'];
  const rows: Partial<ScoredEvent>[] = [];
  const now = new Date();

  for (let i = 0; i < toInsert; i++) {
    const app = applications[i % applications.length];
    const userId = syntheticUsers[i % syntheticUsers.length];
    const isBot = i % 7 === 0;
    const fraudScore = isBot
      ? 0.85 + Math.random() * 0.15
      : Math.random() * 0.35;
    const qualityScore = 1 - fraudScore;
    const eventType = eventTypes[i % eventTypes.length];
    // Spread ingestedAt across the last 60 days
    const daysAgo = Math.floor(Math.random() * 60);
    const ingestedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    rows.push({
      applicationId: app.id,
      userId,
      developerId: app.developerId,
      eventId: `demo-${i}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      eventType,
      fraudScore,
      qualityScore,
      payoutAmount: 0,
      status: isBot ? 'rejected' : 'scored',
      rejectionReason: isBot ? 'bot_pattern' : null,
      ingestedAt,
      scoredAt: ingestedAt,
      createdAt: ingestedAt,
      updatedAt: ingestedAt,
    });
  }

  // Bulk insert in batches of 500 to avoid statement size limits
  const BATCH = 500;
  let inserted = 0;
  for (let start = 0; start < rows.length; start += BATCH) {
    const batch = rows.slice(start, start + BATCH);
    await repo.insert(batch as ScoredEvent[]);
    inserted += batch.length;
  }
  return inserted;
}
```

- [ ] **Update the `seedScoredEvents` call site in `main()` to remove the `users` and `developers` arguments** (the new function only takes `ds` and `applications`)

Find this call (near the bottom of the file):
```typescript
const scoredEventCount = await seedScoredEvents(
  ds,
  applications,
  users,
  developers,
);
```

Replace with:
```typescript
const scoredEventCount = await seedScoredEvents(ds, applications);
```

- [ ] **Run the seed against a clean DB to verify**

```bash
pnpm run demo:reset && pnpm run demo:seed
```

Expected output includes:
```
✓ Scored events: 3000 rows
```

Check the counts:
```bash
# Expect ~1000 per app, ~100 unique user_ids per app
psql $DATABASE_URL -c "SELECT application_id, COUNT(*) as rows, COUNT(DISTINCT user_id) as unique_users FROM scored_events GROUP BY application_id;"
```

Expected: 3 rows, each with ~1000 rows and ~100 unique_users.

- [ ] **Test the extract preview against the fresh seed**

```bash
# Start API if not running
pnpm run dev:api &

# Login as the TikTok Clone developer and hit preview
# Replace <TOKEN> and <APP_ID> from JURY_LOGIN.md
curl -s -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/v1/packages/extract/preview/<APP_ID> | \
  jq '{row_count: .claimed_metrics.row_count, unique_users: .claimed_metrics.unique_users, sample_count: (.sample_rows | length), flagged: .ui_meta.flagged_sample_count}'
```

Expected: `row_count` ≥ 100, `unique_users` ≥ 5, `sample_count` between 2–8, `flagged` ≥ 0.

- [ ] **Commit**

```bash
git add scripts/demo-seed.ts
git commit -m "chore(seed): bump scored_events to 3k with synthetic user UUIDs and 60d date spread"
```

---

## Task 5: LLM prompt — pseudonymization note

**Files:**
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/package-evaluator.prompt.ts`

- [ ] **Add one instruction line to `buildPrompt`**

In `package-evaluator.prompt.ts`, in the `buildPrompt` function, find the line:

```
- Asking price (USD): ${pkg.price}
```

Add one line directly after it:

```
- Note: user IDs in sample rows are pseudonymized as \`u_<hex>\` — this is privacy hygiene, not a data quality issue.
```

The result should be:
```typescript
  return `...
- Asking price (USD): ${pkg.price}
- Note: user IDs in sample rows are pseudonymized as \`u_<hex>\` — this is privacy hygiene, not a data quality issue.

EVALUATION RUBRIC...`;
```

- [ ] **Build to verify no syntax errors**

```bash
cd apps/dataclaus-nestjs-api && pnpm run build 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/package-evaluator.prompt.ts
git commit -m "fix(evaluator): add pseudonymization note to LLM prompt to prevent false bot flags"
```

---

## Task 6: Frontend — schemas + query keys

**Files:**
- Modify: `apps/dataclaus-web/src/lib/schemas.ts`
- Modify: `apps/dataclaus-web/src/lib/query-keys.ts`

- [ ] **Add two schemas to `schemas.ts`**

At the end of `apps/dataclaus-web/src/lib/schemas.ts`, append:

```typescript
// =============================================================================
// EXTRACTOR — auto-package from app
// =============================================================================

export const EligibleApplicationSchema = z.object({
  id:           z.string().uuid(),
  name:         z.string(),
  category:     z.string().nullable(),
  event_count:  z.number(),
  unique_users: z.number(),
  eligible:     z.boolean(),
  reason:       z.string().optional(),
});
export type EligibleApplication = z.infer<typeof EligibleApplicationSchema>;

export const ExtractedPackageDraftSchema = z.object({
  title:    z.string(),
  category: z.string(),
  claimed_metrics: z.object({
    row_count:         z.number(),
    unique_users:      z.number(),
    date_range_start:  z.string(),
    date_range_end:    z.string(),
  }),
  schema_json:    z.record(z.string()),
  sample_rows:    z.array(z.record(z.unknown())),
  price:          z.coerce.number(),
  application_id: z.string(),
  ui_meta: z.object({
    application_name:      z.string(),
    suggested_price_basis: z.string(),
    flagged_sample_count:  z.number(),
    coverage_warning:      z.string().optional(),
  }),
});
export type ExtractedPackageDraft = z.infer<typeof ExtractedPackageDraftSchema>;
```

- [ ] **Add keys to `query-keys.ts`**

In `apps/dataclaus-web/src/lib/query-keys.ts`, inside the `queryKeys` object, after the `purchases` block, add:

```typescript
  extractor: {
    all:          ['extractor'] as const,
    eligibleApps: () => [...queryKeys.extractor.all, 'eligible-apps'] as const,
    preview:      (appId: string, from?: string, to?: string) =>
      [...queryKeys.extractor.all, 'preview', appId, from ?? '', to ?? ''] as const,
  },
```

- [ ] **Run frontend typecheck**

```bash
cd apps/dataclaus-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Commit**

```bash
git add apps/dataclaus-web/src/lib/schemas.ts apps/dataclaus-web/src/lib/query-keys.ts
git commit -m "feat(extractor): add frontend schemas and query keys"
```

---

## Task 7: Frontend — api.ts functions

**Files:**
- Modify: `apps/dataclaus-web/src/lib/api.ts`

- [ ] **Add two imports at the top of the schemas import block in `api.ts`**

Find the import block from `'./schemas'` in `api.ts` and add these two names to it:

```typescript
  EligibleApplicationSchema,
  ExtractedPackageDraftSchema,
```

- [ ] **Add two exported functions at the bottom of `api.ts`** (after `delistPackage`)

```typescript
// =============================================================================
// EXTRACTOR — auto-package from app
// =============================================================================

export const listEligibleApplications = () =>
  request('/v1/packages/extract/eligible-apps', {
    schema: z.array(EligibleApplicationSchema),
  });

export const extractPackagePreview = (
  appId: string,
  opts?: { from?: string; to?: string },
) => {
  const qs = new URLSearchParams();
  if (opts?.from) qs.set('from', opts.from);
  if (opts?.to)   qs.set('to',   opts.to);
  const query = qs.toString() ? `?${qs}` : '';
  return request(`/v1/packages/extract/preview/${appId}${query}`, {
    schema: ExtractedPackageDraftSchema,
  });
};
```

- [ ] **Add the new export names to the import list in `api-hooks.ts`** (you'll see the imports at the top)

Find the packages-related import block in `api-hooks.ts` (around line 77) and add the two new functions to the import:

```typescript
  listEligibleApplications,
  extractPackagePreview,
```

- [ ] **Typecheck**

```bash
cd apps/dataclaus-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Commit**

```bash
git add apps/dataclaus-web/src/lib/api.ts apps/dataclaus-web/src/lib/api-hooks.ts
git commit -m "feat(extractor): add listEligibleApplications and extractPackagePreview api functions"
```

---

## Task 8: Frontend — api-hooks.ts

**Files:**
- Modify: `apps/dataclaus-web/src/lib/api-hooks.ts`

- [ ] **Add `useEligibleApplications` and `useExtractPreview` at the bottom of `api-hooks.ts`**

```typescript
// =============================================================================
// EXTRACTOR
// =============================================================================

export function useEligibleApplications() {
  return useQuery({
    queryKey: queryKeys.extractor.eligibleApps(),
    queryFn:  listEligibleApplications,
  });
}

/**
 * Returns a mutation so the caller controls when the extract fires.
 * Usage: const { mutateAsync: extract, isPending } = useExtractPreview();
 *        const draft = await extract({ appId, from?, to? });
 */
export function useExtractPreview() {
  return useMutation({
    mutationFn: ({ appId, from, to }: { appId: string; from?: string; to?: string }) =>
      extractPackagePreview(appId, { from, to }),
  });
}
```

- [ ] **Typecheck**

```bash
cd apps/dataclaus-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Commit**

```bash
git add apps/dataclaus-web/src/lib/api-hooks.ts
git commit -m "feat(extractor): useEligibleApplications and useExtractPreview hooks"
```

---

## Task 9: `<CreateFromAppModal>` component

**Files:**
- Create: `apps/dataclaus-web/src/components/packages/CreateFromAppModal.tsx`

This is the main UI. Two steps inside one modal: Step 1 app picker, Step 2 preview+confirm. Uses phosphor-react icons (consistent with withdraw-modal pattern), framer-motion for step transition, and follows info-dense design (mono pseudo-IDs, ⚠ on flagged rows, real stat layout).

- [ ] **Create the file**

Content of `apps/dataclaus-web/src/components/packages/CreateFromAppModal.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Sparkle,
  ArrowRight,
  ArrowLeft,
  Warning,
  CircleNotch,
  Database,
} from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEligibleApplications, useExtractPreview, useCreatePackage } from '@/lib/api-hooks';
import { ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { EligibleApplication, ExtractedPackageDraft } from '@/lib/schemas';

interface Props {
  open: boolean;
  onClose: () => void;
}

const DATE_RANGE_OPTIONS = [
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export function CreateFromAppModal({ open, onClose }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState<'pick' | 'preview'>('pick');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [draft, setDraft] = useState<ExtractedPackageDraft | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');

  const { data: apps, isLoading: appsLoading } = useEligibleApplications();
  const extractMutation = useExtractPreview();
  const createMutation = useCreatePackage();

  function resetAndClose() {
    setStep('pick');
    setSelectedAppId(null);
    setDraft(null);
    setTitle('');
    setPrice('');
    onClose();
  }

  async function handleExtract() {
    if (!selectedAppId) return;
    const to = new Date();
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    try {
      const result = await extractMutation.mutateAsync({
        appId: selectedAppId,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setDraft(result);
      setTitle(result.title);
      setPrice(String(result.price));
      setStep('preview');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to extract preview';
      toast({ title: 'Extraction failed', description: msg });
    }
  }

  async function handleSubmit() {
    if (!draft) return;
    try {
      const res = await createMutation.mutateAsync({
        title: title.trim() || draft.title,
        category: draft.category,
        description: undefined,
        claimed_metrics: draft.claimed_metrics,
        schema_json: draft.schema_json,
        sample_rows: draft.sample_rows,
        price: parseFloat(price) || draft.price,
        application_id: draft.application_id,
      });
      toast({ title: 'Submitted', description: 'DataClaus AI is evaluating your package…' });
      resetAndClose();
      router.push(`/dashboard/packages/${res.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Submission failed';
      toast({ title: 'Submit failed', description: msg });
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && resetAndClose()}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
                <Sparkle weight="fill" className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-slate-900 text-sm tracking-tight">
                {step === 'pick' ? 'Select an application' : 'Package preview'}
              </span>
            </div>
            <button onClick={resetAndClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X weight="bold" className="w-4 h-4" />
            </button>
          </div>

          {/* Step 1 — App picker */}
          {step === 'pick' && (
            <div className="px-6 py-5 space-y-5">
              {appsLoading ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-6 justify-center">
                  <CircleNotch className="w-4 h-4 animate-spin" />
                  Loading your apps…
                </div>
              ) : (apps ?? []).length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  No apps found.{' '}
                  <a href="/dashboard/my-apps" className="text-slate-900 underline">Create one</a> first.
                </p>
              ) : (
                <div className="space-y-2">
                  {(apps ?? []).map((app: EligibleApplication) => (
                    <label
                      key={app.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        app.eligible
                          ? selectedAppId === app.id
                            ? 'border-slate-900 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/50'
                          : 'border-slate-100 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="radio"
                        name="app"
                        value={app.id}
                        disabled={!app.eligible}
                        checked={selectedAppId === app.id}
                        onChange={() => setSelectedAppId(app.id)}
                        className="sr-only"
                      />
                      {/* Radio indicator */}
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedAppId === app.id ? 'border-slate-900' : 'border-slate-300'
                      }`}>
                        {selectedAppId === app.id && (
                          <div className="w-2 h-2 rounded-full bg-slate-900" />
                        )}
                      </div>

                      {/* App info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 truncate">{app.name}</span>
                          {app.category && (
                            <span className="text-xs text-slate-400 font-mono">{app.category}</span>
                          )}
                        </div>
                        {app.eligible ? (
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="font-mono text-xs text-slate-500">
                              {app.unique_users.toLocaleString()} users
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="font-mono text-xs text-slate-500">
                              {app.event_count.toLocaleString()} events
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 mt-0.5">{app.reason}</p>
                        )}
                      </div>

                      <Database weight="duotone" className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    </label>
                  ))}
                </div>
              )}

              {/* Date range selector */}
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Date range</Label>
                <div className="flex gap-2">
                  {DATE_RANGE_OPTIONS.map(opt => (
                    <button
                      key={opt.days}
                      onClick={() => setRangeDays(opt.days)}
                      className={`flex-1 text-xs py-1.5 px-2 rounded-lg border transition-all ${
                        rangeDays === opt.days
                          ? 'border-slate-900 bg-slate-900 text-white font-medium'
                          : 'border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  disabled={!selectedAppId || extractMutation.isPending}
                  onClick={handleExtract}
                  className="gap-1.5"
                >
                  {extractMutation.isPending ? (
                    <>
                      <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                      Extracting…
                    </>
                  ) : (
                    <>
                      Extract preview
                      <ArrowRight weight="bold" className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — Preview */}
          {step === 'preview' && draft && (
            <div className="px-6 py-5 space-y-5">
              {/* Stats bar — large mono numerals */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: draft.claimed_metrics.row_count.toLocaleString(), label: 'rows' },
                  { value: draft.claimed_metrics.unique_users.toLocaleString(), label: 'unique users' },
                  { value: `${draft.claimed_metrics.date_range_start} → ${draft.claimed_metrics.date_range_end.slice(5)}`, label: 'date range' },
                ].map(({ value, label }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="font-mono text-sm font-semibold text-slate-900 leading-tight truncate">{value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Sample table */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                  Sample rows ({draft.sample_rows.length})
                  {draft.ui_meta.flagged_sample_count > 0 && (
                    <span className="ml-2 text-amber-600">
                      · {draft.ui_meta.flagged_sample_count} flagged
                    </span>
                  )}
                </p>
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-3 py-2 font-mono text-slate-400 font-normal">user_pseudo_id</th>
                        <th className="text-left px-3 py-2 font-mono text-slate-400 font-normal">event_type</th>
                        <th className="text-right px-3 py-2 font-mono text-slate-400 font-normal">quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.sample_rows.map((row, i) => {
                        const qs = typeof row.quality_score === 'number' ? row.quality_score : parseFloat(String(row.quality_score ?? 0));
                        const flagged = qs < 0.3;
                        return (
                          <tr
                            key={i}
                            className={`border-b border-slate-50 last:border-0 ${flagged ? 'bg-amber-50/60' : ''}`}
                          >
                            <td className="px-3 py-1.5 font-mono text-slate-600 truncate max-w-[140px]">
                              {String(row.user_pseudo_id ?? '')}
                            </td>
                            <td className="px-3 py-1.5 text-slate-700">
                              {String(row.event_type ?? '')}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <span className={`font-mono ${flagged ? 'text-amber-700' : 'text-slate-600'}`}>
                                {qs.toFixed(2)}
                                {flagged && <Warning weight="fill" className="inline w-3 h-3 ml-1 text-amber-500" />}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="pkg-title" className="text-xs text-slate-500">Title</Label>
                  <Input
                    id="pkg-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="mt-1 font-medium"
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="pkg-price" className="text-xs text-slate-500">
                    Price (USD)
                    <span className="ml-2 font-normal text-slate-400 text-xs">{draft.ui_meta.suggested_price_basis}</span>
                  </Label>
                  <Input
                    id="pkg-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setStep('pick')}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft weight="bold" className="w-3 h-3" />
                  Back
                </button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !title.trim() || parseFloat(price) <= 0}
                  className="gap-1.5"
                >
                  {createMutation.isPending ? (
                    <>
                      <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    'Submit for AI Evaluation →'
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Typecheck**

```bash
cd apps/dataclaus-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Commit**

```bash
git add apps/dataclaus-web/src/components/packages/CreateFromAppModal.tsx
git commit -m "feat(ui): CreateFromAppModal — 2-step app picker + preview with ⚠ quality indicators"
```

---

## Task 10: Packages page — replace button with dropdown

**Files:**
- Modify: `apps/dataclaus-web/src/app/dashboard/packages/page.tsx`

- [ ] **Replace the existing page content with the dropdown version**

In `apps/dataclaus-web/src/app/dashboard/packages/page.tsx`, make these changes:

1. Add two imports at the top:

```typescript
import { useState } from 'react';
import { CreateFromAppModal } from '@/components/packages/CreateFromAppModal';
```

2. Add `ChevronDown` to the lucide imports (already imported: `Package, Database, Clock`):

Actually the page uses `lucide-react` for icons. Add the Sparkle icon from phosphor-react instead for the modal trigger — or just use a Unicode glyph to avoid import confusion. Use this inline pattern:

3. In `PackagesContent()`, add state for modal open and replace the existing header section:

Find the existing header block in `PackagesContent`:
```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
      Data Packages
    </h1>
    <p className="text-slate-500 mt-1">
      Submit datasets for AI evaluation and listing on the marketplace.
    </p>
  </div>
  <Link href="/dashboard/packages/new">
    <Button>New Package</Button>
  </Link>
</div>
```

Replace with:

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
      Data Packages
    </h1>
    <p className="text-slate-500 mt-1">
      Submit datasets for AI evaluation and listing on the marketplace.
    </p>
  </div>
  <div className="relative">
    <div className="flex">
      <Button
        onClick={() => setModalOpen(true)}
        className="rounded-r-none border-r border-white/20"
      >
        ✨ From an app
      </Button>
      <div className="relative">
        <Button
          variant="outline"
          className="rounded-l-none border-l-0 px-2"
          onClick={() => setDropdownOpen(v => !v)}
        >
          <span className="sr-only">More options</span>
          <svg viewBox="0 0 12 12" width={12} height={12} fill="currentColor">
            <path d="M6 8L1 3h10L6 8z"/>
          </svg>
        </Button>
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 min-w-[160px]">
            <Link
              href="/dashboard/packages/new"
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setDropdownOpen(false)}
            >
              From scratch (advanced)
            </Link>
          </div>
        )}
      </div>
    </div>
    <CreateFromAppModal open={modalOpen} onClose={() => setModalOpen(false)} />
  </div>
</div>
```

4. Add state declarations inside `PackagesContent` before the loading check:

```typescript
const [modalOpen, setModalOpen]       = useState(false);
const [dropdownOpen, setDropdownOpen] = useState(false);
```

- [ ] **Typecheck**

```bash
cd apps/dataclaus-web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Test manually in browser**

```bash
pnpm run dev:web
```

Open http://localhost:3001, login as `developer.social@dataclaus.demo / demo1234`, navigate to `/dashboard/packages`. Verify:
- "✨ From an app" button visible in the header
- Clicking it opens the 2-step modal
- App picker shows TikTok Clone with eligible status and event/user counts
- Selecting an app and clicking "Extract preview" fetches real data and shows step 2
- Step 2 shows the stats bar, sample table with ⚠ on flagged rows, and editable title/price
- Submitting redirects to the evaluating page

- [ ] **Commit**

```bash
git add apps/dataclaus-web/src/app/dashboard/packages/page.tsx
git commit -m "feat(ui): replace New Package button with ✨ From an app split-button on packages page"
```

---

## Task 11: JURY_LOGIN.md + integration rehearsal

**Files:**
- Modify: `JURY_LOGIN.md`

- [ ] **Update the submission section in JURY_LOGIN.md**

Find any reference to "Submit your first package" or the JSON form submission steps. Add (or replace) with:

```markdown
## Submitting a Package (Demo Step 2–4)

1. Login as `developer.social@dataclaus.demo` / `demo1234`
2. Navigate to **Data Packages** in the sidebar
3. Click **✨ From an app** (the primary button in the top-right)
4. In the modal → **Step 1**: Select `TikTok Clone`, keep `Last 30 days`, click **Extract preview**
5. **Step 2**: Review the package preview — note the sample rows and any ⚠ flagged rows
6. Adjust the title if desired, click **Submit for AI Evaluation →**
7. Wait 3–8 seconds for Claude to evaluate the package
8. Watch the status flip to **Certified** with Claude's summary and trust score

## Fee split (packages): 90% → developer, 10% → platform
```

Also update any line that says "95% seller / 5% platform" to "90% developer / 10% platform".

- [ ] **Run full end-to-end rehearsal**

Start the full stack:
```bash
pnpm run demo:reset && pnpm run demo:seed
pnpm run dev:api &
pnpm run dev:web &
```

Open two browser tabs:
- Tab 1: Login as `developer.social@dataclaus.demo` / `demo1234` → `/dashboard/packages`
- Tab 2: Login as `buyer.brandone@dataclaus.demo` / `demo1234` → `/dashboard/marketplace`

Run the full demo script:
1. Tab 1: Click "✨ From an app" → Select TikTok Clone → Extract preview → Review → Submit
2. Confirm 3–8s evaluation and status flip to "Certified"
3. Tab 2: Refresh marketplace → Find the newly submitted package at the top → Click → Purchase
4. Tab 1: Navigate to `/dashboard/wallet` — verify balance increased
5. Optional: Login as `admin@dataclaus.demo` → Admin panel → find the rejected (0.42 score) seeded package

If any step fails, fix it before marking this task done.

- [ ] **Commit**

```bash
git add JURY_LOGIN.md
git commit -m "docs: update JURY_LOGIN.md with auto-extract submission flow and correct 90/10 fee split"
```

---

## Self-Review Checklist

After implementation, verify these spec requirements have a corresponding task:

| Spec requirement | Task |
|---|---|
| `/v1/packages/extract/eligible-apps` endpoint | Task 3 |
| `/v1/packages/extract/preview/:appId` endpoint | Task 3 |
| `scored_events` aggregation for row_count + unique_users | Task 2 |
| Stratified sample (6 high quality + 2 low quality) | Task 2 |
| `RANDOM()` ordering for sample (not `md5(id || now()::text)`) | Task 2 |
| Anonymization `u_<sha256(userId+appId)[:8]>` | Task 2 |
| Category suggestion from event_type distribution | Task 2 |
| Price suggestion from baseline table | Task 2 |
| Ownership check + admin bypass | Task 2 |
| `EXTRACT_MIN_ROWS = 100` threshold | Task 2 |
| `EXTRACT_MIN_UNIQUE_USERS = 5` privacy guardrail | Task 2 |
| Pseudonymization note in LLM prompt | Task 5 |
| Seed updated to 3k rows + synthetic user UUIDs + bulk insert | Task 4 |
| `EligibleApplicationSchema` + `ExtractedPackageDraftSchema` | Task 6 |
| `queryKeys.extractor.eligibleApps()` + `preview()` | Task 6 |
| `listEligibleApplications` + `extractPackagePreview` in api.ts | Task 7 |
| `useEligibleApplications` + `useExtractPreview` hooks | Task 8 |
| 2-step modal with app picker + stats bar + sample table + ⚠ | Task 9 |
| Packages page dropdown trigger | Task 10 |
| JURY_LOGIN.md updated | Task 11 |
| Full e2e rehearsal | Task 11 |
| Existing POST /v1/packages unchanged | All tasks (never touched) |
| Existing marketplace, purchase, ledger flows unchanged | All tasks (never touched) |
