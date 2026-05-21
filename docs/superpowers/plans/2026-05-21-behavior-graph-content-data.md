# Behavior Graph + Content Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a `DataPackage` a typed bundle of three dimensions (behavior + demographic + device), each AI-valued separately by Gemini under bounded anchors, with a marketplace UI that shows the itemized invoice the buyer is buying.

**Architecture:** Tiktok-backend stays stateless and proxies a watch-event forward to dataclaus-core. Dataclaus-core gains two new entities (`WatchEvent`, `UserProfile`) and an internal ingest endpoint. The extractor service fans out across dimensions configured per app (`APP_DIMENSIONS`). The Gemini auditor returns per-dimension unit prices clamped to industry-anchor bands. The frontend renders three dimension cards on the auto-extract preview and on the marketplace detail page.

**Tech Stack:** NestJS 10 + TypeORM 0.3 + Postgres (core), Express/NestJS (tiktok-backend), Next.js 14 App Router + Radix + TanStack Query + zod 4 (web), Gemini 2.0 Flash (LLM), Expo (mobile — not touched in this iteration).

**Spec:** [docs/superpowers/specs/2026-05-21-behavior-graph-content-data-design.md](../specs/2026-05-21-behavior-graph-content-data-design.md)

**Deferred from spec §11 AC1:** Production migration files for `watch_events` and `user_profiles`. Dev relies on `synchronize:true` (matches the existing project pattern — `1715300000000-AddDataPackages.ts` is the prior parallel). When prod deployment becomes relevant, generate via `pnpm typeorm migration:generate -d ... AddWatchEventsAndProfiles`. Out of scope for this plan.

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `apps/dataclaus-nestjs-api/src/modules/watch-events/entities/watch-event.entity.ts` | TypeORM entity for `watch_events` table |
| `apps/dataclaus-nestjs-api/src/modules/watch-events/watch-events.module.ts` | Wires entity + service + controller |
| `apps/dataclaus-nestjs-api/src/modules/watch-events/internal-ingest.controller.ts` | `POST /v1/internal/watch-events`, guarded by static secret header |
| `apps/dataclaus-nestjs-api/src/modules/watch-events/internal-ingest.service.ts` | Resolves video tags/category and persists row |
| `apps/dataclaus-nestjs-api/src/modules/dataclaus-user/entities/user-profile.entity.ts` | TypeORM entity for `user_profiles` table |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dimension-extractor.helpers.ts` | Pure helpers for per-dimension aggregation + sampling |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dimensions.constants.ts` | `APP_DIMENSIONS`, `INDUSTRY_ANCHORS`, dimension type defs |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/dto/dimension-payload.dto.ts` | Shared `DimensionPayloadDto` shape |
| `apps/dataclaus-web/src/components/marketplace/DimensionBreakdownCard.tsx` | Single-dimension card used in both preview modal and detail page |
| `apps/dataclaus-web/src/components/marketplace/DimensionGrid.tsx` | Layout wrapper that picks 1/2/3-card layout based on dimension count |

### Files to modify

| Path | Change |
|---|---|
| `apps/tiktok-backend/src/videos/videos.service.ts` | Extend `Video` interface with `tags: string[]` + `category: string` |
| `apps/tiktok-backend/data/videos.json` | Replace with 50 tagged videos |
| `apps/tiktok-backend/src/videos/videos.controller.ts` | `recordView` becomes forwarder |
| `apps/tiktok-backend/src/dataclaus/dataclaus.service.ts` | New `forwardWatchEvent()` method |
| `apps/tiktok-backend/.env.example` + local `.env` | Add `DATACLAUS_INTERNAL_INGEST_SECRET` |
| `apps/dataclaus-nestjs-api/.env.example` + local `.env` | Add `INTERNAL_INGEST_SECRET` |
| `apps/dataclaus-nestjs-api/src/app.module.ts` | Register `WatchEventsModule` + `UserProfile` TypeORM feature |
| `apps/dataclaus-nestjs-api/src/modules/dataclaus-user/dataclaus-user.module.ts` | Register `UserProfile` entity |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.ts` | Multi-dimension extract + spec coverage |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.spec.ts` | Spec extended for dimensions |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/extract-preview.dto.ts` | Add `dimensions` field |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/entities/data-package.entity.ts` | `dimensions` jsonb column + types |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/dto/create-package.dto.ts` | Accept `dimensions` |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/package-evaluator.prompt.ts` | Per-dimension valuation block + retry prompt |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/llm-evaluation.schema.ts` | Extended zod schema |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/package-evaluator.service.ts` | Clamp + total computation |
| `apps/dataclaus-nestjs-api/src/modules/data-packages/data-packages.service.ts` | Persist `dimensions`; populate backward-compat fields from device dim |
| `apps/dataclaus-web/src/lib/schemas.ts` | Extend `ExtractPreviewResponseSchema`, `DataPackageSchema` |
| `apps/dataclaus-web/src/lib/api.ts` | (no shape change — schemas drive types) |
| `apps/dataclaus-web/src/components/packages/CreateFromAppModal.tsx` | Step 2: 3-card layout |
| `apps/dataclaus-web/src/app/dashboard/marketplace/[id]/page.tsx` | Dimension breakdown rendering |
| `apps/dataclaus-web/src/app/dashboard/marketplace/page.tsx` | Dimension chips on list cards |
| `scripts/demo-seed.ts` | 50 videos × tags, 3000 watch events, 5 profiles, 2 headline packages |
| `scripts/smoke-test-package-marketplace.ts` | Validate dimension shape on certified package |

---

## Task 1: Add dimension constants and types

**Files:**
- Create: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dimensions.constants.ts`
- Create: `apps/dataclaus-nestjs-api/src/modules/data-packages/dto/dimension-payload.dto.ts`

- [ ] **Step 1: Write the constants file**

```ts
// apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dimensions.constants.ts
export type DimensionName = 'behavior' | 'demographic' | 'device';

/**
 * Per-app declared dimensions. Looked up by app name (case-sensitive, matches
 * the demo-seed value). Apps not listed here default to ['device'] only.
 */
export const APP_DIMENSIONS: Record<string, DimensionName[]> = {
  'TikTok Clone':       ['behavior', 'demographic', 'device'],
  'Cinema+ Streaming':  ['device'], // v1.1 will add behavior
  'FitMove Tracker':    ['device'],
};

/**
 * Industry anchor bands for the Gemini valuator prompt. Inclusive bounds.
 * Sources cited in the spec §3.4. Units are USD per 1,000 units.
 */
export const INDUSTRY_ANCHORS: Record<DimensionName, { lowPerThousand: number; highPerThousand: number; unitLabel: string }> = {
  behavior:    { lowPerThousand: 1.0,  highPerThousand: 10.0, unitLabel: 'event'   },
  demographic: { lowPerThousand: 5.0,  highPerThousand: 50.0, unitLabel: 'profile' },
  device:      { lowPerThousand: 0.5,  highPerThousand: 5.0,  unitLabel: 'event'   },
};

/** ±20% beyond the anchor band triggers a clamp + justification annotation. */
export const ANCHOR_CLAMP_TOLERANCE = 0.20;

/** Hardcoded video metadata mirror used by the ingest endpoint. */
export const TAG_TAXONOMY: readonly string[] = [
  'dance', 'comedy', 'gaming', 'beauty', 'food', 'fitness', 'vlog', 'asmr',
  'education', 'music', 'fashion', 'animals', 'travel', 'sports', 'art',
  'diy', 'news', 'lifestyle', 'finance', 'tech',
] as const;
```

- [ ] **Step 2: Write the DimensionPayload DTO**

```ts
// apps/dataclaus-nestjs-api/src/modules/data-packages/dto/dimension-payload.dto.ts
import { DimensionName } from '../extractor/dimensions.constants';

export interface DimensionPayload {
  count: number;
  sample_rows: Record<string, unknown>[];
  distribution?: Record<string, number>;
  schema_json: Record<string, string>;
}

export interface DimensionValuation {
  unit_price_usd: number;
  quality_score: number;
  ai_justification: string;
}

export type DimensionPayloadWithValuation = DimensionPayload & DimensionValuation & {
  total_usd: number;
};

export type DimensionsMap = Partial<Record<DimensionName, DimensionPayload>>;
export type DimensionsMapValued = Partial<Record<DimensionName, DimensionPayloadWithValuation>>;
```

- [ ] **Step 3: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dimensions.constants.ts \
        apps/dataclaus-nestjs-api/src/modules/data-packages/dto/dimension-payload.dto.ts
git commit -m "feat(dimensions): add APP_DIMENSIONS config and dimension DTO shape"
```

---

## Task 2: WatchEvent entity + module skeleton

**Files:**
- Create: `apps/dataclaus-nestjs-api/src/modules/watch-events/entities/watch-event.entity.ts`
- Create: `apps/dataclaus-nestjs-api/src/modules/watch-events/watch-events.module.ts`

- [ ] **Step 1: Write the entity**

```ts
// apps/dataclaus-nestjs-api/src/modules/watch-events/entities/watch-event.entity.ts
import { Entity, Column, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('watch_events')
@Index('idx_watch_app_recorded', ['applicationId', 'recordedAt'])
@Index('idx_watch_user_recorded', ['userId', 'recordedAt'])
export class WatchEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'video_id', type: 'text' })
  videoId: string;

  @Column({ name: 'video_tags', type: 'text', array: true, default: '{}' })
  videoTags: string[];

  @Column({ name: 'video_category', type: 'varchar', length: 50, nullable: true })
  videoCategory: string | null;

  @Column({ name: 'dwell_ms', type: 'int' })
  dwellMs: number;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt: Date;
}
```

- [ ] **Step 2: Write the module shell (controller + service follow in Task 4)**

```ts
// apps/dataclaus-nestjs-api/src/modules/watch-events/watch-events.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchEvent } from './entities/watch-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WatchEvent])],
  exports: [TypeOrmModule],
})
export class WatchEventsModule {}
```

- [ ] **Step 3: Register in app.module.ts**

Find the `imports: [...]` array in `apps/dataclaus-nestjs-api/src/app.module.ts` and add `WatchEventsModule` after the existing module imports (alphabetical insertion near `VerificationModule` / `WalletModule`).

- [ ] **Step 4: Boot the API to verify table creation**

Run: `cd apps/dataclaus-nestjs-api && pnpm run start:dev`
Expected: log line `Found 1 new entity (WatchEvent)` and `query: CREATE TABLE "watch_events" ...`. Kill after table appears.

- [ ] **Step 5: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/watch-events apps/dataclaus-nestjs-api/src/app.module.ts
git commit -m "feat(watch-events): add WatchEvent entity + module"
```

---

## Task 3: UserProfile entity (sibling of DataClausUser)

**Files:**
- Create: `apps/dataclaus-nestjs-api/src/modules/dataclaus-user/entities/user-profile.entity.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/dataclaus-user/dataclaus-user.module.ts`

- [ ] **Step 1: Write the entity**

```ts
// apps/dataclaus-nestjs-api/src/modules/dataclaus-user/entities/user-profile.entity.ts
import { Entity, Column, PrimaryColumn } from 'typeorm';

/**
 * Censored demographic profile. We deliberately store the BUCKET, never the
 * raw age. Gender is one of m/f/x. Locale is the ISO country code only —
 * no city, no IP-derived precision.
 */
@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'age_bucket', type: 'varchar', length: 10 })
  ageBucket: '18-24' | '25-34' | '35-44' | '45-54' | '55+';

  @Column({ type: 'varchar', length: 1 })
  gender: 'm' | 'f' | 'x';

  @Column({ type: 'varchar', length: 5 })
  locale: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
```

- [ ] **Step 2: Register in dataclaus-user.module.ts**

In `apps/dataclaus-nestjs-api/src/modules/dataclaus-user/dataclaus-user.module.ts`, add `UserProfile` to the `TypeOrmModule.forFeature([...])` array and to the `exports` list. Import at the top:

```ts
import { UserProfile } from './entities/user-profile.entity';
```

- [ ] **Step 3: Boot the API to verify table creation**

Run: `cd apps/dataclaus-nestjs-api && pnpm run start:dev`
Expected: `query: CREATE TABLE "user_profiles" ...`. Kill after table appears.

- [ ] **Step 4: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/dataclaus-user/
git commit -m "feat(user-profiles): add censored UserProfile entity"
```

---

## Task 4: Internal ingest endpoint for watch events

**Files:**
- Create: `apps/dataclaus-nestjs-api/src/modules/watch-events/internal-ingest.service.ts`
- Create: `apps/dataclaus-nestjs-api/src/modules/watch-events/internal-ingest.controller.ts`
- Create: `apps/dataclaus-nestjs-api/src/modules/watch-events/dto/ingest-watch-event.dto.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/watch-events/watch-events.module.ts`
- Modify: `apps/dataclaus-nestjs-api/.env` and `.env.example`

- [ ] **Step 1: Add the secret to env files**

Append to `apps/dataclaus-nestjs-api/.env.example`:
```
# Static secret for tiktok-backend → core watch-event ingest. v1.1 promotes to slot/seal HMAC.
INTERNAL_INGEST_SECRET=dev-only-replace-me-7f3a
```

Copy the same line into the local `.env`.

- [ ] **Step 2: Write the DTO**

```ts
// apps/dataclaus-nestjs-api/src/modules/watch-events/dto/ingest-watch-event.dto.ts
import { IsBoolean, IsInt, IsString, IsUUID, Min } from 'class-validator';

export class IngestWatchEventDto {
  @IsUUID() applicationId: string;
  @IsUUID() userId: string;
  @IsString() videoId: string;
  @IsInt() @Min(0) dwellMs: number;
  @IsBoolean() completed: boolean;
}
```

- [ ] **Step 3: Write the static video-metadata mirror**

We resolve `video_tags` + `video_category` server-side (no round-trip to tiktok-backend). The full taxonomy lives in the seed; the runtime needs a deterministic lookup. Create a 50-entry mirror file:

```ts
// apps/dataclaus-nestjs-api/src/modules/watch-events/video-metadata.ts
/**
 * Mirror of apps/tiktok-backend/data/videos.json — only the fields the
 * ingest endpoint needs (id, tags, category). Generated by hand to match
 * the seed; if videos.json changes, regenerate this map.
 */
export const VIDEO_METADATA: Record<string, { tags: string[]; category: string }> = {
  // Entries filled in Task 16 alongside videos.json. Empty placeholder is fine
  // for the wiring tasks — extract still works (rows just have empty tags).
};
```

(The real 50 entries land in Task 16. Empty map here is intentional — wiring tasks below don't depend on the lookup succeeding.)

- [ ] **Step 4: Write the service**

```ts
// apps/dataclaus-nestjs-api/src/modules/watch-events/internal-ingest.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchEvent } from './entities/watch-event.entity';
import { IngestWatchEventDto } from './dto/ingest-watch-event.dto';
import { VIDEO_METADATA } from './video-metadata';

@Injectable()
export class InternalIngestService {
  private readonly logger = new Logger(InternalIngestService.name);

  constructor(
    @InjectRepository(WatchEvent)
    private readonly repo: Repository<WatchEvent>,
  ) {}

  async ingest(dto: IngestWatchEventDto): Promise<void> {
    const meta = VIDEO_METADATA[dto.videoId] ?? { tags: [], category: 'other' };
    await this.repo.save(this.repo.create({
      applicationId: dto.applicationId,
      userId: dto.userId,
      videoId: dto.videoId,
      videoTags: meta.tags,
      videoCategory: meta.category,
      dwellMs: dto.dwellMs,
      completed: dto.completed,
    }));
  }
}
```

- [ ] **Step 5: Write the controller**

```ts
// apps/dataclaus-nestjs-api/src/modules/watch-events/internal-ingest.controller.ts
import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngestWatchEventDto } from './dto/ingest-watch-event.dto';
import { InternalIngestService } from './internal-ingest.service';

@Controller('v1/internal/watch-events')
export class InternalIngestController {
  constructor(
    private readonly service: InternalIngestService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async ingest(
    @Body() dto: IngestWatchEventDto,
    @Headers('x-internal-secret') secret?: string,
  ): Promise<{ ok: true }> {
    const expected = this.config.get<string>('INTERNAL_INGEST_SECRET');
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid internal ingest secret');
    }
    await this.service.ingest(dto);
    return { ok: true };
  }
}
```

- [ ] **Step 6: Wire into the module**

Update `apps/dataclaus-nestjs-api/src/modules/watch-events/watch-events.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchEvent } from './entities/watch-event.entity';
import { InternalIngestController } from './internal-ingest.controller';
import { InternalIngestService } from './internal-ingest.service';

@Module({
  imports: [TypeOrmModule.forFeature([WatchEvent])],
  controllers: [InternalIngestController],
  providers: [InternalIngestService],
  exports: [TypeOrmModule],
})
export class WatchEventsModule {}
```

- [ ] **Step 7: Boot + smoke the endpoint**

Run the API; then in another shell:
```bash
curl -X POST http://localhost:3000/v1/internal/watch-events \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: dev-only-replace-me-7f3a" \
  -d '{"applicationId":"b6ee3a76-5863-45f0-84cf-f10dd55423f5","userId":"00000000-0000-0000-0000-000000000001","videoId":"vid_01","dwellMs":4200,"completed":true}'
```
Expected: `{"ok":true}`. Without the header: `401`.

Then `psql … -c "select count(*) from watch_events;"` shows 1.

- [ ] **Step 8: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/watch-events/ apps/dataclaus-nestjs-api/.env*
git commit -m "feat(watch-events): internal ingest endpoint with secret guard"
```

---

## Task 5: tiktok-backend forwarder

**Files:**
- Modify: `apps/tiktok-backend/src/dataclaus/dataclaus.service.ts`
- Modify: `apps/tiktok-backend/src/videos/videos.controller.ts`
- Modify: `apps/tiktok-backend/src/videos/videos.service.ts`
- Modify: `apps/tiktok-backend/.env` and `.env.example`

- [ ] **Step 1: Add ingest secret to tiktok-backend env**

Append to `apps/tiktok-backend/.env.example` AND local `.env`:
```
DATACLAUS_INTERNAL_INGEST_SECRET=dev-only-replace-me-7f3a
```
The value MUST match `INTERNAL_INGEST_SECRET` set in the core API in Task 4 step 1.

- [ ] **Step 2: Add forwarder method to DataClausService**

Open `apps/tiktok-backend/src/dataclaus/dataclaus.service.ts`. Add the following method on the existing class (use the existing `apiUrl` field; if it doesn't exist on this class, read it via the same `ConfigService` pattern other methods use):

```ts
async forwardWatchEvent(payload: {
  applicationId: string;
  userId: string;
  videoId: string;
  dwellMs: number;
  completed: boolean;
}): Promise<void> {
  const secret = this.config.get<string>('DATACLAUS_INTERNAL_INGEST_SECRET');
  if (!secret) {
    // Demo-tolerant: log and skip. Marketplace extract will see fewer events.
    return;
  }
  try {
    await fetch(`${this.apiUrl}/v1/internal/watch-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Don't fail the feed view if the forward fails; marketplace data just gets sparser.
    // (Intentional: feed UX > extract completeness in this iteration.)
  }
}
```

- [ ] **Step 3: Extend Video interface with tags + category**

In `apps/tiktok-backend/src/videos/videos.service.ts`, find the `interface Video { ... }` block and add:

```ts
export interface Video {
  id: string;
  url: string;
  thumbnail: string;
  description: string;
  creator: VideoCreator;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  music: VideoMusic;
  tags: string[];        // NEW
  category: string;      // NEW
}
```

The existing JSON loader already accepts arbitrary fields, so old `data/videos.json` entries without `tags`/`category` will produce `undefined` — handle by defaulting:

```ts
// inside loadVideos(), after parsing:
this.videos = this.videos.map(v => ({
  ...v,
  tags: v.tags ?? [],
  category: v.category ?? 'other',
}));
```

- [ ] **Step 4: Make recordView forward to core**

Open `apps/tiktok-backend/src/videos/videos.controller.ts`. Find the `recordView` handler (the one bound to `POST /videos/:id/view` that accepts `RecordViewDto`). Inject `DataClausService` if not already injected (look at how `getFeed` resolves user from Bearer token — same pattern). Replace the handler body so that AFTER the existing in-memory update:

```ts
@Post(':id/view')
async recordView(
  @Param('id') id: string,
  @Body() dto: RecordViewDto,
  @Headers('authorization') authHeader?: string,
): Promise<{ success: boolean }> {
  // existing in-memory tracking stays
  const result = this.videosService.recordView(id, dto);

  // NEW: forward to dataclaus core for marketplace extract
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const user = await this.dataClausService.getUserProfile(token);
      if (user?.id) {
        await this.dataClausService.forwardWatchEvent({
          applicationId: process.env.DATACLAUS_APP_ID ?? '',
          userId: user.id,
          videoId: id,
          dwellMs: dto.duration,
          completed: dto.completed,
        });
      }
    } catch {
      // Forwarding is best-effort. Don't break the mobile feed UX.
    }
  }

  return result;
}
```

If `recordView` doesn't exist yet in the controller as shown in the recon, check the actual handler name (`view`/`recordView`/`postView`); the recon showed `/videos/:id/view` exists. Read the file first to confirm the exact method signature before editing.

- [ ] **Step 5: Boot both servers + smoke**

Terminal 1: `pnpm run dev:api` (core).
Terminal 2: `cd apps/tiktok-backend && npm run start:dev`.
Terminal 3:
```bash
# Login as alice via tiktok-backend
TOKEN=$(curl -s -X POST http://localhost:4001/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user.alice@dataclaus.demo","password":"demo1234"}' | jq -r '.token')

# Submit a view
curl -X POST http://localhost:4001/videos/vid_01/view \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"duration":5400,"completed":true}'
```

Expected: `{"success":true}` from tiktok-backend AND a new row in `watch_events`:
```bash
psql $DATABASE_URL -c "select user_id, video_id, dwell_ms, completed from watch_events order by recorded_at desc limit 1;"
```

- [ ] **Step 6: Commit**

```bash
git add apps/tiktok-backend/
git commit -m "feat(tiktok-backend): forward video view as watch_event to core"
```

---

## Task 6: Extractor dimension helpers (pure functions)

**Files:**
- Create: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dimension-extractor.helpers.ts`

- [ ] **Step 1: Write the helpers — pure, query-result → DTO**

```ts
// apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dimension-extractor.helpers.ts
import * as crypto from 'crypto';
import { DimensionPayload } from '../dto/dimension-payload.dto';

const BEHAVIOR_SCHEMA: Record<string, string> = {
  user_pseudo_id:  'string',
  video_id:        'string',
  video_tags:      'string[]',
  video_category:  'string',
  dwell_ms:        'number',
  completed:       'boolean',
  recorded_at:     'timestamp',
};

const DEMOGRAPHIC_SCHEMA: Record<string, string> = {
  user_pseudo_id: 'string',
  age_bucket:     'string',
  gender:         'string',
  locale:         'string',
};

export function pseudonymize(userId: string, appId: string): string {
  const h = crypto.createHash('sha256').update(`${userId}|${appId}`).digest('hex');
  return `u_${h.slice(0, 8)}`;
}

export interface WatchEventRow {
  user_id: string;
  video_id: string;
  video_tags: string[];
  video_category: string | null;
  dwell_ms: number;
  completed: boolean;
  recorded_at: Date;
}

export interface ProfileRow {
  user_id: string;
  age_bucket: string;
  gender: string;
  locale: string;
}

export function buildBehaviorDimension(
  appId: string,
  rows: WatchEventRow[],
  tagCounts: Map<string, number>,
  totalCount: number,
  sampleLimit = 8,
): DimensionPayload {
  // Stratified sample: 4 completed, 2 short-bounce (dwell<3000 & !completed), 2 random
  const completed = rows.filter(r => r.completed).slice(0, 4);
  const bounces = rows.filter(r => !r.completed && r.dwell_ms < 3000).slice(0, 2);
  const usedIds = new Set([...completed, ...bounces].map(r => r.user_id + r.video_id));
  const rest = rows.filter(r => !usedIds.has(r.user_id + r.video_id)).slice(0, sampleLimit - completed.length - bounces.length);
  const samples = [...completed, ...bounces, ...rest].slice(0, sampleLimit);

  const sample_rows = samples.map(r => ({
    user_pseudo_id: pseudonymize(r.user_id, appId),
    video_id: r.video_id,
    video_tags: r.video_tags,
    video_category: r.video_category,
    dwell_ms: r.dwell_ms,
    completed: r.completed,
    recorded_at: r.recorded_at.toISOString(),
  }));

  const distribution: Record<string, number> = {};
  for (const [tag, count] of tagCounts) distribution[tag] = count;

  return {
    count: totalCount,
    sample_rows,
    distribution,
    schema_json: BEHAVIOR_SCHEMA,
  };
}

export function buildDemographicDimension(
  appId: string,
  rows: ProfileRow[],
  totalCount: number,
  sampleLimit = 8,
): DimensionPayload {
  const sample_rows = rows.slice(0, sampleLimit).map(r => ({
    user_pseudo_id: pseudonymize(r.user_id, appId),
    age_bucket: r.age_bucket,
    gender: r.gender,
    locale: r.locale,
  }));

  const ageBuckets: Record<string, number> = {};
  const genders: Record<string, number> = {};
  const locales: Record<string, number> = {};
  for (const r of rows) {
    ageBuckets[r.age_bucket] = (ageBuckets[r.age_bucket] ?? 0) + 1;
    genders[r.gender] = (genders[r.gender] ?? 0) + 1;
    locales[r.locale] = (locales[r.locale] ?? 0) + 1;
  }

  return {
    count: totalCount,
    sample_rows,
    distribution: {
      ...Object.fromEntries(Object.entries(ageBuckets).map(([k, v]) => [`age:${k}`, v])),
      ...Object.fromEntries(Object.entries(genders).map(([k, v]) => [`gender:${k}`, v])),
      ...Object.fromEntries(Object.entries(locales).map(([k, v]) => [`locale:${k}`, v])),
    },
    schema_json: DEMOGRAPHIC_SCHEMA,
  };
}
```

- [ ] **Step 2: Write a quick test for the pseudonymize + sample stratification**

```ts
// apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dimension-extractor.helpers.spec.ts
import { buildBehaviorDimension, pseudonymize, WatchEventRow } from './dimension-extractor.helpers';

describe('dimension-extractor helpers', () => {
  it('pseudonymize is deterministic per (user, app)', () => {
    expect(pseudonymize('u1', 'a1')).toEqual(pseudonymize('u1', 'a1'));
    expect(pseudonymize('u1', 'a1')).not.toEqual(pseudonymize('u1', 'a2'));
    expect(pseudonymize('u1', 'a1')).toMatch(/^u_[0-9a-f]{8}$/);
  });

  it('behavior sampler stratifies completed + bounces + rest', () => {
    const rows: WatchEventRow[] = Array.from({ length: 20 }, (_, i) => ({
      user_id: `u${i}`, video_id: `v${i}`, video_tags: [], video_category: null,
      dwell_ms: i % 3 === 0 ? 1000 : 10000,
      completed: i % 3 !== 0,
      recorded_at: new Date(),
    }));
    const dim = buildBehaviorDimension('app1', rows, new Map(), 20, 8);
    expect(dim.count).toBe(20);
    expect(dim.sample_rows.length).toBe(8);
    const completed = dim.sample_rows.filter((r: any) => r.completed).length;
    expect(completed).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 3: Run the test**

```bash
cd apps/dataclaus-nestjs-api && pnpm test -- dimension-extractor.helpers.spec
```
Expected: 2 passing.

- [ ] **Step 4: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dimension-extractor.helpers*
git commit -m "feat(extractor): pure helpers for behavior+demographic dimensions"
```

---

## Task 7: Extend ApplicationExtractorService.extract for multi-dimension

**Files:**
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/extract-preview.dto.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/application-extractor.service.spec.ts`

- [ ] **Step 1: Update the extract-preview DTO**

Open `apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/dto/extract-preview.dto.ts`. Add a new optional `dimensions` field alongside whatever exists today:

```ts
import { DimensionsMap } from '../../dto/dimension-payload.dto';

export interface ExtractedPackageDraftDto {
  // existing fields stay (suggested_title, suggested_category, date_range, etc.)
  // ...
  dimensions?: DimensionsMap;
}
```

Re-read the existing DTO and INSERT the field without removing anything; back-compat clients keep working.

- [ ] **Step 2: Wire dimensions into the service**

In `application-extractor.service.ts`, locate the `extract(appId, devId, role, dateRange)` method. After the existing scored_events aggregate (which becomes the device dimension), add:

```ts
import {
  buildBehaviorDimension,
  buildDemographicDimension,
  WatchEventRow,
  ProfileRow,
} from './dimension-extractor.helpers';
import { APP_DIMENSIONS, DimensionName } from './dimensions.constants';
import { DimensionsMap } from '../dto/dimension-payload.dto';
```

Inside `extract`, AFTER the existing device aggregation, add:

```ts
const dimensionsToExtract: DimensionName[] = APP_DIMENSIONS[app.name] ?? ['device'];
const dimensions: DimensionsMap = {};

// Device dimension — repackage the existing scored_events data into the new shape
dimensions.device = {
  count: rowCount,
  sample_rows: sampleRowsForDevice, // whatever the existing code already produces
  distribution: typeDistribution,    // whatever the existing code already produces
  schema_json: SCHEMA_JSON,
};

if (dimensionsToExtract.includes('behavior')) {
  const [bAgg] = await this.dataSource.query<{ count: string }[]>(
    `SELECT COUNT(*)::text AS count FROM watch_events
     WHERE application_id = $1 AND recorded_at BETWEEN $2 AND $3`,
    [app.id, from, to],
  );
  const bCount = parseInt(bAgg?.count ?? '0', 10);
  if (bCount > 0) {
    const bRows = await this.dataSource.query<WatchEventRow[]>(
      `SELECT user_id, video_id, video_tags, video_category, dwell_ms, completed, recorded_at
       FROM watch_events
       WHERE application_id = $1 AND recorded_at BETWEEN $2 AND $3
       ORDER BY recorded_at DESC LIMIT 200`,
      [app.id, from, to],
    );
    const tagCounts = new Map<string, number>();
    for (const r of bRows) for (const t of r.video_tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    dimensions.behavior = buildBehaviorDimension(app.id, bRows, tagCounts, bCount);
  }
}

if (dimensionsToExtract.includes('demographic')) {
  // Profiles are scoped to users-who-have-events-in-range to keep it cohesive
  const profileRows = await this.dataSource.query<ProfileRow[]>(
    `SELECT DISTINCT p.user_id, p.age_bucket, p.gender, p.locale
     FROM user_profiles p
     WHERE p.user_id IN (
       SELECT DISTINCT user_id FROM watch_events
       WHERE application_id = $1 AND recorded_at BETWEEN $2 AND $3
     )`,
    [app.id, from, to],
  );
  if (profileRows.length > 0) {
    dimensions.demographic = buildDemographicDimension(app.id, profileRows, profileRows.length);
  }
}

// Backward compat: the response still carries the flat sample_rows / claimed_metrics
// from the device dimension. Pass `dimensions` alongside.
```

Add `dimensions` to the returned DTO. Do NOT remove the existing flat fields.

- [ ] **Step 3: Extend the existing spec**

In `application-extractor.service.spec.ts`, add a new `describe('dimensions', () => { ... })` block that:
- Seeds 5 `watch_events` rows and 2 `user_profiles` rows into the test datasource (use the same fixture pattern the file already establishes — read the spec first to see how)
- Calls `service.extract(tikTokAppId, devId, 'developer', range)`
- Asserts `result.dimensions.behavior.count === 5` and `result.dimensions.demographic.count === 2`
- Asserts `result.dimensions.device.count` matches what the existing test expects

If the existing spec uses an in-memory or mocked datasource and adding new tables is heavy, an alternative is to mock `this.dataSource.query` per-call. Look at how the existing spec mocks it and follow the same approach.

- [ ] **Step 4: Run the spec**

```bash
cd apps/dataclaus-nestjs-api && pnpm test -- application-extractor.service.spec
```
Expected: all existing tests still pass + new dimension tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/extractor/
git commit -m "feat(extractor): multi-dimension extract (behavior + demographic + device)"
```

---

## Task 8: DataPackage.dimensions jsonb column

**Files:**
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/entities/data-package.entity.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/dto/create-package.dto.ts`

- [ ] **Step 1: Add the column + type**

At the top of `data-package.entity.ts` after the existing exports:

```ts
import { DimensionsMapValued } from '../dto/dimension-payload.dto';
```

In the `DataPackage` class, after the existing `llmEvaluation` column, add:

```ts
@Column({ name: 'dimensions', type: 'jsonb', nullable: true })
dimensions: DimensionsMapValued | null;
```

- [ ] **Step 2: Add to CreatePackageDto**

In `create-package.dto.ts`, add an optional `dimensions` field at the bottom of the DTO class:

```ts
import { IsOptional, IsObject } from 'class-validator';

// inside the DTO class:
@IsOptional()
@IsObject()
dimensions?: Record<string, unknown>;
```

(Loose typing is intentional — the structural validation happens upstream in the extractor; this DTO is the wire shape.)

- [ ] **Step 3: Boot API to verify column creation**

```bash
cd apps/dataclaus-nestjs-api && pnpm run start:dev
```
Expected: `query: ALTER TABLE "data_packages" ADD "dimensions" jsonb`.

- [ ] **Step 4: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/
git commit -m "feat(data-packages): add dimensions jsonb column"
```

---

## Task 9: Gemini prompt + zod schema — per-dimension valuation

**Files:**
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/package-evaluator.prompt.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/llm-evaluation.schema.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/entities/data-package.entity.ts`

- [ ] **Step 1: Extend the LlmEvaluation interface**

In `data-package.entity.ts`, extend `LlmEvaluation`:

```ts
export interface DimensionValuationResult {
  unit_price_usd: number;
  quality_score: number;
  ai_justification: string;
}

export interface LlmEvaluation {
  trust_score: number;
  summary: string;
  red_flags: string[];
  buyer_match: string[];
  rubric: {
    schema_integrity: number;
    sample_diversity: number;
    bot_signature_absence: number;
    claim_evidence_alignment: number;
    price_fairness: number;
  };
  confidence: 'high' | 'medium' | 'low';
  verdict: 'certified' | 'rejected';
  dimensions?: {
    behavior?: DimensionValuationResult;
    demographic?: DimensionValuationResult;
    device?: DimensionValuationResult;
  };
}
```

- [ ] **Step 2: Extend the zod schema**

In `llm-evaluation.schema.ts`, add an optional `dimensions` field to the existing schema:

```ts
import { z } from 'zod';

const DimensionValuationSchema = z.object({
  unit_price_usd: z.number().min(0),
  quality_score: z.number().min(0).max(1),
  ai_justification: z.string().min(1),
});

// In the existing LlmEvaluationSchema, add at the end of the .object({...}):
//   dimensions: z.object({
//     behavior:    DimensionValuationSchema.optional(),
//     demographic: DimensionValuationSchema.optional(),
//     device:      DimensionValuationSchema.optional(),
//   }).optional(),
```

Read the existing file first; insert without breaking existing keys.

- [ ] **Step 3: Extend the prompt**

In `package-evaluator.prompt.ts`, find the `buildPrompt` function. AFTER the existing RUBRIC section and BEFORE the OUTPUT section, inject (if `pkg.dimensions` is present):

```ts
const dimensionsBlock = pkg.dimensions
  ? `
DIMENSIONS PRESENT
${Object.entries(pkg.dimensions).map(([name, dim]: any) => `
- ${name.toUpperCase()}: ${dim.count} units
  Schema: ${JSON.stringify(dim.schema_json)}
  Sample (first 3): ${JSON.stringify((dim.sample_rows ?? []).slice(0, 3))}
  ${dim.distribution ? `Top distribution: ${JSON.stringify(Object.entries(dim.distribution).slice(0, 5))}` : ''}
`).join('\n')}

For each dimension above, you ALSO output a per-dimension valuation. Industry anchor bands (USD per 1,000 units):
- behavior:    $1–10 per 1,000 events
- demographic: $5–50 per 1,000 profiles
- device:      $0.50–5 per 1,000 events

Quality multipliers (apply within band):
- behavior: completion rate >60% → upper band; tag diversity >30 → upper band
- demographic: completeness <80% → lower band
- device: bot-flagged fraction >10% → lower band
`
  : '';
```

Insert `${dimensionsBlock}` into the prompt string. Then extend the JSON output schema in the prompt (the literal block) to include:

```
  "dimensions": {
    "behavior":    { "unit_price_usd": <float, anchored to band>, "quality_score": <0-1>, "ai_justification": "<1 sentence>" },
    "demographic": { "unit_price_usd": <float>, "quality_score": <0-1>, "ai_justification": "<1 sentence>" },
    "device":      { "unit_price_usd": <float>, "quality_score": <0-1>, "ai_justification": "<1 sentence>" }
  }
```

(Optional fields: omit dimensions the package doesn't contain.)

- [ ] **Step 4: Run any existing prompt tests**

```bash
cd apps/dataclaus-nestjs-api && pnpm test -- package-evaluator
```
Expected: passing. If there are no specs for the prompt itself, this just builds — that's fine.

- [ ] **Step 5: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/
git commit -m "feat(evaluator): per-dimension AI valuation in prompt + schema"
```

---

## Task 10: PackageEvaluatorService — clamp + total computation

**Files:**
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/package-evaluator.service.ts`
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/data-packages.service.ts`

- [ ] **Step 1: Add clamp + totals helper to evaluator service**

In `package-evaluator.service.ts`, add a private method:

```ts
import { INDUSTRY_ANCHORS, ANCHOR_CLAMP_TOLERANCE, DimensionName } from './extractor/dimensions.constants';
import { DimensionsMap, DimensionsMapValued } from './dto/dimension-payload.dto';

private clampAndTotal(
  dimensions: DimensionsMap,
  valuations: LlmEvaluation['dimensions'],
): DimensionsMapValued {
  const out: DimensionsMapValued = {};
  for (const name of Object.keys(dimensions) as DimensionName[]) {
    const dim = dimensions[name]!;
    const val = valuations?.[name];
    if (!val) continue;
    const anchor = INDUSTRY_ANCHORS[name];
    const lowPerUnit  = (anchor.lowPerThousand  / 1000) * (1 - ANCHOR_CLAMP_TOLERANCE);
    const highPerUnit = (anchor.highPerThousand / 1000) * (1 + ANCHOR_CLAMP_TOLERANCE);
    let unitPrice = val.unit_price_usd;
    let justification = val.ai_justification;
    if (unitPrice < lowPerUnit) {
      unitPrice = lowPerUnit;
      justification += ' (adjusted to industry band)';
    } else if (unitPrice > highPerUnit) {
      unitPrice = highPerUnit;
      justification += ' (adjusted to industry band)';
    }
    out[name] = {
      ...dim,
      unit_price_usd: unitPrice,
      quality_score: val.quality_score,
      ai_justification: justification,
      total_usd: Math.round(dim.count * unitPrice * 100) / 100,
    };
  }
  return out;
}
```

- [ ] **Step 2: Extend the stub fallback**

In the same file, find `stubEvaluate(pkg)`. If `pkg.dimensions` is present, the stub also emits midpoint valuations:

```ts
private stubDimensionValuations(dimensions: DimensionsMap): LlmEvaluation['dimensions'] {
  const out: NonNullable<LlmEvaluation['dimensions']> = {};
  for (const name of Object.keys(dimensions) as DimensionName[]) {
    const anchor = INDUSTRY_ANCHORS[name];
    const mid = (anchor.lowPerThousand + anchor.highPerThousand) / 2 / 1000;
    out[name] = {
      unit_price_usd: mid,
      quality_score: 0.7,
      ai_justification: 'Auditor offline — defaulted to market median',
    };
  }
  return out;
}
```

Inside `stubEvaluate`, set `evaluation.dimensions = pkg.dimensions ? this.stubDimensionValuations(pkg.dimensions as any) : undefined;` before returning.

- [ ] **Step 3: Wire clamping into the caller**

In `data-packages.service.ts`, find where `packageEvaluator.evaluate(pkg)` is called and the result is persisted. After getting the `LlmEvaluation`, before saving, compute the final `dimensions` payload:

```ts
const llm = await this.packageEvaluator.evaluate(pkg);
const dimensionsValued = pkg.dimensions
  ? this.packageEvaluator.clampAndTotal(pkg.dimensions as DimensionsMap, llm.dimensions)
  : null;

pkg.llmEvaluation = llm;
pkg.dimensions = dimensionsValued;
pkg.dataclausScore = llm.trust_score;
pkg.evaluatedAt = new Date();
pkg.status = llm.verdict === 'certified' ? PackageStatus.CERTIFIED : PackageStatus.REJECTED;

// price is the sum of dimension totals; if no dimensions (legacy), keep existing price
if (dimensionsValued) {
  pkg.price = Object.values(dimensionsValued).reduce((sum, d) => sum + d.total_usd, 0);
}

await this.repo.save(pkg);
```

Expose `clampAndTotal` as `public` on the evaluator (was private in Step 1; flip the modifier).

- [ ] **Step 4: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/
git commit -m "feat(evaluator): clamp per-dim prices to industry band + compute totals"
```

---

## Task 11: DataPackagesService — persist dimensions from extract → create flow

**Files:**
- Modify: `apps/dataclaus-nestjs-api/src/modules/data-packages/data-packages.service.ts`

- [ ] **Step 1: Read the existing create flow**

Open `data-packages.service.ts` and find the `create()` method (the one called by `POST /v1/packages`). Note where it currently consumes `CreatePackageDto` and where it persists the entity. The `claimedMetrics`, `schemaJson`, `sampleRows` fields are populated from the DTO today.

- [ ] **Step 2: Persist dimensions when present**

In `create()`, before `this.repo.save(pkg)`:

```ts
if (dto.dimensions) {
  pkg.dimensions = dto.dimensions as any; // structural validation happens via the DTO's IsObject + downstream evaluator
}

// Backward compat: ensure claimed_metrics / schema_json / sample_rows are populated from device dim
// if the DTO didn't supply them flat (so old buyer UI keeps rendering).
const deviceDim = (dto.dimensions as any)?.device;
if (deviceDim) {
  pkg.claimedMetrics ??= {
    row_count: deviceDim.count,
    unique_users: deviceDim.distribution?.['unique_users'] ?? 0,
    date_range_start: dto.claimed_metrics?.date_range_start ?? new Date().toISOString().slice(0, 10),
    date_range_end:   dto.claimed_metrics?.date_range_end   ?? new Date().toISOString().slice(0, 10),
  };
  pkg.schemaJson ??= deviceDim.schema_json;
  pkg.sampleRows ??= deviceDim.sample_rows;
}
```

- [ ] **Step 3: Boot + manual smoke**

Start the API. POST a sample package via curl (or the existing smoke script after we update it in Task 18):

```bash
curl -X POST http://localhost:3000/v1/packages \
  -H 'Authorization: Bearer <dev-token>' \
  -H 'Content-Type: application/json' \
  -d '{"title":"test","category":"social","dimensions":{"device":{"count":100,"sample_rows":[],"schema_json":{"x":"string"}}}}'
```

Verify the row in `data_packages` has the `dimensions` jsonb populated:
```bash
psql $DATABASE_URL -c "select id, status, dimensions from data_packages order by created_at desc limit 1;"
```

- [ ] **Step 4: Commit**

```bash
git add apps/dataclaus-nestjs-api/src/modules/data-packages/data-packages.service.ts
git commit -m "feat(data-packages): persist dimensions on create, populate backward-compat fields"
```

---

## Task 12: Frontend zod schemas + types

**Files:**
- Modify: `apps/dataclaus-web/src/lib/schemas.ts`

- [ ] **Step 1: Add the dimension schemas**

In `apps/dataclaus-web/src/lib/schemas.ts`, after the existing schemas, add:

```ts
export const DimensionPayloadSchema = z.object({
  count: z.number(),
  sample_rows: z.array(z.record(z.unknown())),
  distribution: z.record(z.number()).optional(),
  schema_json: z.record(z.string()),
});

export const DimensionPayloadValuedSchema = DimensionPayloadSchema.extend({
  unit_price_usd: z.number(),
  quality_score: z.number().min(0).max(1),
  ai_justification: z.string(),
  total_usd: z.number(),
});

export const DimensionsMapSchema = z.object({
  behavior:    DimensionPayloadSchema.optional(),
  demographic: DimensionPayloadSchema.optional(),
  device:      DimensionPayloadSchema.optional(),
});

export const DimensionsMapValuedSchema = z.object({
  behavior:    DimensionPayloadValuedSchema.optional(),
  demographic: DimensionPayloadValuedSchema.optional(),
  device:      DimensionPayloadValuedSchema.optional(),
});

export type DimensionPayload = z.infer<typeof DimensionPayloadSchema>;
export type DimensionPayloadValued = z.infer<typeof DimensionPayloadValuedSchema>;
export type DimensionsMap = z.infer<typeof DimensionsMapSchema>;
export type DimensionsMapValued = z.infer<typeof DimensionsMapValuedSchema>;
```

- [ ] **Step 2: Extend the existing ExtractPreviewResponseSchema**

Find the existing `ExtractPreviewResponseSchema` (it should be there — the extractor returns this shape). Add `dimensions: DimensionsMapSchema.optional()` to its object literal. Do not remove existing fields.

- [ ] **Step 3: Extend the existing DataPackageSchema**

Find `DataPackageSchema` (used by `useMyPurchases`, `useMarketplacePackages`, etc.). Add `dimensions: DimensionsMapValuedSchema.nullable().optional()`. Nullable because legacy packages have `null` in the DB column.

- [ ] **Step 4: Typecheck**

```bash
cd apps/dataclaus-web && pnpm run typecheck
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/dataclaus-web/src/lib/schemas.ts
git commit -m "feat(web): zod schemas for dimension payloads"
```

---

## Task 13: DimensionBreakdownCard + DimensionGrid components

**Files:**
- Create: `apps/dataclaus-web/src/components/marketplace/DimensionBreakdownCard.tsx`
- Create: `apps/dataclaus-web/src/components/marketplace/DimensionGrid.tsx`

- [ ] **Step 1: Write the card**

```tsx
// apps/dataclaus-web/src/components/marketplace/DimensionBreakdownCard.tsx
import type { DimensionPayload, DimensionPayloadValued } from '@/lib/schemas';

const DIMENSION_LABEL: Record<string, string> = {
  behavior: 'BEHAVIOR',
  demographic: 'DEMOGRAPHIC',
  device: 'DEVICE',
};

const DIMENSION_HINT: Record<string, string> = {
  behavior:    'watch + tags + engagement',
  demographic: 'censored age + gender + locale',
  device:      'sensor signal + bot-detection',
};

type Props = {
  name: 'behavior' | 'demographic' | 'device';
  dim: DimensionPayload | DimensionPayloadValued;
};

function isValued(d: DimensionPayload | DimensionPayloadValued): d is DimensionPayloadValued {
  return 'unit_price_usd' in d;
}

export function DimensionBreakdownCard({ name, dim }: Props) {
  const valued = isValued(dim);
  const topDist = Object.entries(dim.distribution ?? {}).slice(0, 5);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[10px] tracking-[0.18em] text-white/60 font-semibold">{DIMENSION_LABEL[name]}</h4>
        <span className="font-mono text-2xl tabular-nums">{dim.count.toLocaleString()}</span>
      </div>
      <p className="text-xs text-white/50 mb-3">{DIMENSION_HINT[name]}</p>

      {topDist.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topDist.map(([k, v]) => (
            <span key={k} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-white/70">
              {k} · {v}
            </span>
          ))}
        </div>
      )}

      {valued ? (
        <div className="border-t border-white/10 pt-3 mt-2">
          <div className="font-mono text-xs text-white/70">
            ${dim.unit_price_usd.toFixed(4)} / {name === 'demographic' ? 'profile' : 'event'} × {dim.count.toLocaleString()}
          </div>
          <div className="font-mono text-lg tabular-nums mt-1">${dim.total_usd.toFixed(2)}</div>
          <p className="text-[11px] italic text-white/55 mt-2 leading-snug">{dim.ai_justification}</p>
          <p className="text-[10px] text-white/40 mt-2">AI quality: {(dim.quality_score * 100).toFixed(0)}%</p>
        </div>
      ) : (
        <p className="text-[11px] italic text-white/40 border-t border-white/10 pt-3 mt-2">
          Est. value: pending AI audit
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the grid wrapper**

```tsx
// apps/dataclaus-web/src/components/marketplace/DimensionGrid.tsx
import type { DimensionsMap, DimensionsMapValued } from '@/lib/schemas';
import { DimensionBreakdownCard } from './DimensionBreakdownCard';

type Props = {
  dimensions: DimensionsMap | DimensionsMapValued;
};

const ORDER: Array<'behavior' | 'demographic' | 'device'> = ['behavior', 'demographic', 'device'];

export function DimensionGrid({ dimensions }: Props) {
  const present = ORDER.filter(k => dimensions[k]);
  if (present.length === 0) return null;

  const cols = present.length === 1 ? 'grid-cols-1' : present.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className={`grid gap-3 ${cols}`}>
      {present.map(name => (
        <DimensionBreakdownCard key={name} name={name} dim={dimensions[name]!} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/dataclaus-web && pnpm run typecheck
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/dataclaus-web/src/components/marketplace/
git commit -m "feat(ui): DimensionBreakdownCard + DimensionGrid"
```

---

## Task 14: Use DimensionGrid in CreateFromAppModal Step 2

**Files:**
- Modify: `apps/dataclaus-web/src/components/packages/CreateFromAppModal.tsx`

- [ ] **Step 1: Read the existing Step 2 implementation**

Open the modal and find the Step 2 (preview) section. The current rendering uses a flat sample table built from `extractPreview.sample_rows`. Note the wrapping element classes so the new grid sits in place.

- [ ] **Step 2: Replace flat sample table with DimensionGrid**

Import:
```tsx
import { DimensionGrid } from '@/components/marketplace/DimensionGrid';
```

In Step 2's JSX, find the block that today renders `extractPreview.sample_rows`. Replace it with:

```tsx
{extractPreview.dimensions
  ? <DimensionGrid dimensions={extractPreview.dimensions} />
  : (/* keep existing flat sample table fallback here unchanged */ ...) }
```

Move the existing flat-table JSX into the `else` branch verbatim — don't delete it; legacy preview responses without `dimensions` still need to render.

- [ ] **Step 3: Manual verification**

Start the API + web (`pnpm run dev:api`, `cd apps/dataclaus-web && npm run dev`). Log in as `developer.social@dataclaus.demo`, open `/dashboard/packages`, click "✨ From an app", select TikTok Clone, click "Extract preview".

Expected: three dimension cards visible. (Real numbers will only show once Task 16 seeds data — for now demographic + behavior may be zero or absent, that's OK.)

- [ ] **Step 4: Commit**

```bash
git add apps/dataclaus-web/src/components/packages/CreateFromAppModal.tsx
git commit -m "feat(ui): use DimensionGrid in CreateFromAppModal preview"
```

---

## Task 15: Use DimensionGrid in marketplace detail + list chips

**Files:**
- Modify: `apps/dataclaus-web/src/app/dashboard/marketplace/[id]/page.tsx`
- Modify: `apps/dataclaus-web/src/app/dashboard/marketplace/page.tsx`

- [ ] **Step 1: Add the grid to the detail page**

In `[id]/page.tsx`, find where the existing single sample table renders. Add above it (or replace, if the grid is the primary view):

```tsx
import { DimensionGrid } from '@/components/marketplace/DimensionGrid';

// in the JSX, where package details render:
{pkg.dimensions && (
  <section className="space-y-3 mb-6">
    <h3 className="text-xs tracking-[0.18em] text-white/60 font-semibold">DIMENSION BREAKDOWN</h3>
    <DimensionGrid dimensions={pkg.dimensions} />
    <DimensionTotalStrip dimensions={pkg.dimensions} />
  </section>
)}
```

Add the strip component inline in the same file (or extract to a sibling — your call; inline is fine for one usage):

```tsx
function DimensionTotalStrip({ dimensions }: { dimensions: NonNullable<typeof pkg.dimensions> }) {
  const dims = Object.values(dimensions).filter(Boolean);
  const total = dims.reduce((s, d: any) => s + d.total_usd, 0);
  const deviceOnly = dimensions.device?.total_usd ?? 0;
  const multiDim = dims.length > 1;

  return (
    <div className="flex items-center justify-between border-t border-white/10 pt-4">
      <div className="space-y-1">
        <div className="text-[10px] tracking-[0.18em] text-white/60">PACKAGE TOTAL</div>
        <div className="font-mono text-3xl tabular-nums">${total.toFixed(2)}</div>
      </div>
      {multiDim && deviceOnly > 0 && (
        <div className="text-right space-y-1">
          <div className="text-[10px] text-white/50">Device-only would be</div>
          <div className="font-mono text-sm text-white/70">${deviceOnly.toFixed(2)}</div>
          <div className="text-[10px] text-white/40">{(total / deviceOnly).toFixed(1)}× richer</div>
        </div>
      )}
    </div>
  );
}
```

Keep the existing single-sample-table block as a fallback for `!pkg.dimensions`.

- [ ] **Step 2: Add chips to the marketplace list cards**

In `marketplace/page.tsx`, find where each package card renders. Add a row under the title:

```tsx
{pkg.dimensions && (
  <div className="flex gap-1.5 mt-1">
    {(['behavior','demographic','device'] as const).filter(k => pkg.dimensions?.[k]).map(k => (
      <span key={k} className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] tracking-wider text-white/60 font-mono">
        {k}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/dataclaus-web && pnpm run typecheck
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/dataclaus-web/src/app/dashboard/marketplace/
git commit -m "feat(ui): dimension breakdown on marketplace detail + chips on list"
```

---

## Task 16: Seed 50 tagged videos + populate VIDEO_METADATA mirror

**Files:**
- Modify: `apps/tiktok-backend/data/videos.json`
- Modify: `apps/dataclaus-nestjs-api/src/modules/watch-events/video-metadata.ts`

- [ ] **Step 1: Write the 50-video JSON**

Replace `apps/tiktok-backend/data/videos.json` with 50 entries. Each entry has all the existing fields (id, url, thumbnail, description, creator, music, like/comment/share/view counts) PLUS `tags: string[]` (1-3 from TAG_TAXONOMY) and `category: string` (one of dance/comedy/gaming/beauty/food/fitness/vlog/asmr/education/music/fashion/animals/travel/sports/art/diy/news/lifestyle/finance/tech).

Use deterministic IDs: `vid_01` through `vid_50`. URLs can reference existing placeholders or external CDN demos. The shape MUST keep the existing structure intact so VideosService.loadVideos doesn't break.

Suggested distribution: 8 dance, 6 comedy, 5 gaming, 5 beauty, 5 food, 4 fitness, 4 vlog, 3 music, 3 education, 2 fashion, 2 animals, 1 travel, 1 art, 1 tech.

- [ ] **Step 2: Mirror into VIDEO_METADATA**

Update `apps/dataclaus-nestjs-api/src/modules/watch-events/video-metadata.ts`:

```ts
export const VIDEO_METADATA: Record<string, { tags: string[]; category: string }> = {
  vid_01: { tags: ['dance', 'music'], category: 'dance' },
  vid_02: { tags: ['comedy'], category: 'comedy' },
  // ... 48 more rows matching videos.json exactly
};
```

Each `vid_NN` entry's `tags` and `category` MUST match the JSON file.

- [ ] **Step 3: Restart tiktok-backend + verify**

```bash
cd apps/tiktok-backend && npm run start:dev
curl http://localhost:4001/videos/feed?page=1&limit=3 | jq '.items[0].video | {id, tags, category}'
```
Expected: the response includes tags and category.

- [ ] **Step 4: Commit**

```bash
git add apps/tiktok-backend/data/videos.json apps/dataclaus-nestjs-api/src/modules/watch-events/video-metadata.ts
git commit -m "feat(seed): 50 tagged videos + ingest metadata mirror"
```

---

## Task 17: Seed watch events + user profiles + headline packages

**Files:**
- Modify: `scripts/demo-seed.ts`

- [ ] **Step 1: Add UserProfile imports + repo**

At the top of `demo-seed.ts`, import the new entity:

```ts
import { UserProfile } from '../apps/dataclaus-nestjs-api/src/modules/dataclaus-user/entities/user-profile.entity';
import { WatchEvent } from '../apps/dataclaus-nestjs-api/src/modules/watch-events/entities/watch-event.entity';
```

Add both to the `DataSource` `entities: [...]` array.

- [ ] **Step 2: Seed user profiles for the 5 end users**

After the block that creates the 5 end users (`user.alice` etc.), add:

```ts
const profiles: Array<Partial<UserProfile>> = [
  { userId: aliceId,  ageBucket: '25-34', gender: 'f', locale: 'TR' },
  { userId: bobId,    ageBucket: '25-34', gender: 'm', locale: 'TR' },
  { userId: cemId,    ageBucket: '35-44', gender: 'm', locale: 'TR' },
  { userId: denizId,  ageBucket: '18-24', gender: 'x', locale: 'US' },
  { userId: elifId,   ageBucket: '18-24', gender: 'f', locale: 'DE' },
];
const profileRepo = ds.getRepository(UserProfile);
for (const p of profiles) {
  const existing = await profileRepo.findOne({ where: { userId: p.userId! } });
  if (!existing) await profileRepo.save(profileRepo.create(p));
}
console.log(`✓ Seeded ${profiles.length} user profiles`);
```

Replace `aliceId` etc. with whatever variable names the file already uses for those user IDs.

- [ ] **Step 3: Seed watch events**

After the profiles block, add:

```ts
const tiktokAppId = 'b6ee3a76-5863-45f0-84cf-f10dd55423f5'; // from JURY_LOGIN.md
const userIds = [aliceId, bobId, cemId, denizId, elifId];

// User → favored tags (gives Gemini a recognizable affinity pattern)
const userTagAffinity: Record<string, string[]> = {
  [aliceId]: ['dance', 'beauty', 'music'],
  [bobId]:   ['gaming', 'tech', 'education'],
  [cemId]:   ['food', 'fitness'],
  [denizId]: ['comedy', 'animals', 'vlog'],
  [elifId]:  ['fashion', 'lifestyle', 'art'],
};

// Build a video lookup (need this to know each video's tags when generating events)
const videoMeta: Array<{ id: string; tags: string[]; category: string }> = JSON.parse(
  require('fs').readFileSync(
    require('path').join(__dirname, '..', 'apps', 'tiktok-backend', 'data', 'videos.json'),
    'utf-8',
  ),
).map((v: any) => ({ id: v.id, tags: v.tags ?? [], category: v.category ?? 'other' }));

const watchRepo = ds.getRepository(WatchEvent);
const existingWatch = await watchRepo.count({ where: { applicationId: tiktokAppId } });
if (existingWatch === 0) {
  const rows: Partial<WatchEvent>[] = [];
  const now = Date.now();
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  let botCounter = 0;
  for (let i = 0; i < 3000; i++) {
    const userId = userIds[i % userIds.length];
    const affinity = userTagAffinity[userId];
    // 70% of events on affinity-matching videos, 30% random
    const matchingVids = videoMeta.filter(v => v.tags.some(t => affinity.includes(t)));
    const pickPool = Math.random() < 0.7 && matchingVids.length > 0 ? matchingVids : videoMeta;
    const video = pickPool[Math.floor(Math.random() * pickPool.length)];
    const isBot = ++botCounter % 10 === 0; // ~10% bot-like
    const dwellMs = isBot ? 200 : Math.floor(2000 + Math.random() * 28000);
    rows.push({
      applicationId: tiktokAppId,
      userId,
      videoId: video.id,
      videoTags: video.tags,
      videoCategory: video.category,
      dwellMs,
      completed: !isBot && dwellMs > 12000,
      recordedAt: new Date(now - Math.random() * sixtyDaysMs),
    });
  }
  // Batch insert
  for (let i = 0; i < rows.length; i += 200) {
    await watchRepo.save(watchRepo.create(rows.slice(i, i + 200)));
  }
  console.log(`✓ Seeded ${rows.length} watch_events for TikTok Clone`);
}
```

- [ ] **Step 4: Seed 2 headline packages with hand-built dimensions**

After the existing 6 seeded packages, add 2 more. Find the existing package-seeding block (probably uses `DataPackage` repo and iterates a `seeds` array). Append:

```ts
const headlinePackages = [
  {
    title: 'TikTok Clone — Behavior & Demo Q1',
    category: 'social',
    developerEmail: 'developer.social@dataclaus.demo',
    applicationId: tiktokAppId,
    dimensions: {
      behavior: {
        count: 2463,
        sample_rows: [
          { user_pseudo_id: 'u_a8c1f1d2', video_id: 'vid_07', video_tags: ['dance'], dwell_ms: 18400, completed: true, recorded_at: '2026-04-12T14:22:00Z' },
          { user_pseudo_id: 'u_3f9b21cc', video_id: 'vid_19', video_tags: ['gaming','tech'], dwell_ms: 24100, completed: true, recorded_at: '2026-04-13T09:05:00Z' },
          { user_pseudo_id: 'u_a8c1f1d2', video_id: 'vid_32', video_tags: ['music'], dwell_ms: 200, completed: false, recorded_at: '2026-04-14T19:11:00Z' },
        ],
        distribution: { dance: 412, gaming: 358, comedy: 298, beauty: 287, food: 241 },
        schema_json: { user_pseudo_id:'string', video_id:'string', video_tags:'string[]', video_category:'string', dwell_ms:'number', completed:'boolean', recorded_at:'timestamp' },
        unit_price_usd: 0.0042,
        quality_score: 0.88,
        ai_justification: '68% completion, 18-tag breadth, strong content affinity per user',
        total_usd: 10.34,
      },
      demographic: {
        count: 2100,
        sample_rows: [
          { user_pseudo_id: 'u_a8c1f1d2', age_bucket: '25-34', gender: 'f', locale: 'TR' },
          { user_pseudo_id: 'u_3f9b21cc', age_bucket: '25-34', gender: 'm', locale: 'TR' },
          { user_pseudo_id: 'u_c0d12345', age_bucket: '18-24', gender: 'f', locale: 'DE' },
        ],
        distribution: { 'age:18-24': 720, 'age:25-34': 950, 'age:35-44': 380, 'age:45-54': 50, 'gender:f': 1180, 'gender:m': 880, 'gender:x': 40, 'locale:TR': 1450, 'locale:DE': 320, 'locale:US': 330 },
        schema_json: { user_pseudo_id:'string', age_bucket:'string', gender:'string', locale:'string' },
        unit_price_usd: 0.0235,
        quality_score: 0.74,
        ai_justification: 'Broad coverage across age and locale; gender balance reasonable',
        total_usd: 49.35,
      },
      device: {
        count: 1247,
        sample_rows: [
          { user_pseudo_id: 'u_a8c1f1d2', event_type: 'scroll', sensor_class: 'touch', quality_score: 0.92, session_id: 'sess_001', recorded_at: '2026-04-12T14:22:00Z' },
        ],
        distribution: { scroll: 612, screen_view: 423, touch: 212 },
        schema_json: { user_pseudo_id:'string', event_type:'string', sensor_class:'string', quality_score:'number', session_id:'string', recorded_at:'timestamp' },
        unit_price_usd: 0.0019,
        quality_score: 0.81,
        ai_justification: 'Median fraud_score 0.86, ~9% bot-flagged rows correctly isolated',
        total_usd: 2.37,
      },
    },
    status: 'certified',
    dataclausScore: 0.91,
  },
  {
    title: 'FitMove — Device-Only Baseline',
    category: 'fitness',
    developerEmail: 'developer.fitness@dataclaus.demo',
    applicationId: '080b4833-f7ec-44f5-89e9-19dd0823cc15',
    dimensions: {
      device: {
        count: 8420,
        sample_rows: [
          { user_pseudo_id: 'u_b8c1f00d', event_type: 'accelerometer', sensor_class: 'motion', quality_score: 0.95, session_id: 'sess_a01', recorded_at: '2026-04-10T07:14:00Z' },
        ],
        distribution: { accelerometer: 4200, gyroscope: 3100, touch: 1120 },
        schema_json: { user_pseudo_id:'string', event_type:'string', sensor_class:'string', quality_score:'number', session_id:'string', recorded_at:'timestamp' },
        unit_price_usd: 0.0048,
        quality_score: 0.87,
        ai_justification: 'High fidelity motion data, low bot signature',
        total_usd: 40.42,
      },
    },
    status: 'certified',
    dataclausScore: 0.87,
  },
];

const pkgRepo = ds.getRepository(DataPackage);
for (const h of headlinePackages) {
  const exists = await pkgRepo.findOne({ where: { title: h.title } });
  if (exists) continue;
  const dev = await developerRepo.findOne({ where: { email: h.developerEmail } });
  const total = Object.values(h.dimensions).reduce((s: number, d: any) => s + d.total_usd, 0);
  await pkgRepo.save(pkgRepo.create({
    developerId: dev!.id,
    applicationId: h.applicationId,
    title: h.title,
    description: `Hand-curated headline package showcasing the ${Object.keys(h.dimensions).length}-dimension data profile of this app.`,
    category: h.category,
    price: total,
    status: h.status as any,
    dataclausScore: h.dataclausScore,
    dimensions: h.dimensions as any,
    claimedMetrics: {
      row_count: (h.dimensions as any).device?.count ?? 0,
      unique_users: 5,
      date_range_start: '2026-03-15',
      date_range_end: '2026-04-15',
    },
    schemaJson: (h.dimensions as any).device?.schema_json ?? {},
    sampleRows: (h.dimensions as any).device?.sample_rows ?? [],
    llmEvaluation: {
      trust_score: h.dataclausScore,
      summary: 'Hand-curated demo package.',
      red_flags: [],
      buyer_match: ['advertisers', 'data partners'],
      rubric: { schema_integrity: 0.9, sample_diversity: 0.85, bot_signature_absence: 0.88, claim_evidence_alignment: 0.9, price_fairness: 0.9 },
      confidence: 'high',
      verdict: 'certified',
      dimensions: Object.fromEntries(Object.entries(h.dimensions).map(([k, v]: any) => [k, {
        unit_price_usd: v.unit_price_usd,
        quality_score: v.quality_score,
        ai_justification: v.ai_justification,
      }])) as any,
    },
    evaluatedAt: new Date(),
  } as any));
}
console.log(`✓ Seeded ${headlinePackages.length} headline packages`);
```

- [ ] **Step 5: Run the seed end-to-end**

```bash
pnpm run demo:reset
```

Expected: `✓ Seeded 5 user profiles`, `✓ Seeded 3000 watch_events for TikTok Clone`, `✓ Seeded 2 headline packages`.

Verify:
```bash
psql $DATABASE_URL -c "select count(*) from watch_events;"
psql $DATABASE_URL -c "select count(*) from user_profiles;"
psql $DATABASE_URL -c "select title, status, dimensions->'behavior'->>'count' from data_packages where title like '%Behavior & Demo%';"
```

- [ ] **Step 6: Commit**

```bash
git add scripts/demo-seed.ts
git commit -m "feat(seed): watch_events + user_profiles + 2 headline packages with dimensions"
```

---

## Task 18: Update smoke test for dimension shape

**Files:**
- Modify: `scripts/smoke-test-package-marketplace.ts`

- [ ] **Step 1: Read the existing smoke test**

The script logs in as a developer, submits a package, polls until `certified|rejected`, then logs in as a buyer and purchases. Find the assertion block that checks the certified package.

- [ ] **Step 2: Add dimension assertion**

After confirming `pkg.status === 'certified'`, add:

```ts
if (!pkg.dimensions || typeof pkg.dimensions !== 'object') {
  throw new Error(`Smoke fail: package ${pkg.id} has no dimensions field`);
}
const dimNames = Object.keys(pkg.dimensions);
if (!dimNames.includes('device')) {
  throw new Error(`Smoke fail: package ${pkg.id} missing device dimension`);
}
// If the test seeds a TikTok Clone package, expect all three:
if (pkg.application_id === 'b6ee3a76-5863-45f0-84cf-f10dd55423f5') {
  for (const required of ['behavior', 'demographic', 'device']) {
    if (!(required in pkg.dimensions)) {
      throw new Error(`Smoke fail: TikTok Clone package ${pkg.id} missing ${required} dimension`);
    }
    const d: any = pkg.dimensions[required];
    if (typeof d.unit_price_usd !== 'number' || d.unit_price_usd <= 0) {
      throw new Error(`Smoke fail: ${required} dimension has invalid unit_price_usd`);
    }
  }
}
console.log('✓ Dimensions shape OK:', dimNames.join(', '));
```

- [ ] **Step 3: Switch the smoke developer to TikTok Clone**

Change the `DEV_EMAIL` constant from `developer.fitness@…` to `developer.social@dataclaus.demo` so the live submission exercises the multi-dimension path.

- [ ] **Step 4: Run the smoke**

```bash
pnpm exec ts-node --transpile-only --project scripts/tsconfig.json scripts/smoke-test-package-marketplace.ts
```
Expected: exits 0 with `✓ Dimensions shape OK: behavior, demographic, device`.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-test-package-marketplace.ts
git commit -m "test(smoke): assert dimension shape on live-extracted TikTok package"
```

---

## Task 19: End-to-end demo dress rehearsal

**Files:**
- (none — this is verification)

- [ ] **Step 1: Clean reset**

```bash
docker-compose up -d
pnpm run dev:api &
pnpm run demo:reset
```
Expected: API boots, all tables exist, seed completes cleanly.

- [ ] **Step 2: Smoke tests**

```bash
pnpm run smoke:slot-seal
pnpm exec ts-node --transpile-only --project scripts/tsconfig.json scripts/smoke-test-package-marketplace.ts
```
Expected: both exit 0.

- [ ] **Step 3: Manual walkthrough**

1. Open `localhost:3001`, login as `buyer.brandone@dataclaus.demo` / `demo1234`.
2. Visit `/dashboard/marketplace`. Confirm:
   - TikTok Clone — Behavior & Demo Q1 visible with 3 chips (`behavior`, `demographic`, `device`)
   - FitMove — Device-Only Baseline visible with 1 chip (`device`)
3. Click into TikTok Clone package. Confirm dimension grid renders 3 cards with prices and AI justifications. Confirm "Device-only would be: $2.37 · 26.5× richer" callout.
4. Click into FitMove package. Confirm single device dimension card. No comparison callout.
5. Logout, login as `developer.social@dataclaus.demo`. Open `/dashboard/packages` → ✨ From an app → TikTok Clone, Last 30 days, Extract preview.
6. Confirm Step 2 shows three dimension cards with real (live-extracted) numbers.
7. Submit. Watch status flip from `evaluating` → `certified` within ~5s.
8. The new package appears on `/dashboard/marketplace` with 3 chips and AI-priced dimensions.
9. As `buyer.brandone`, purchase the new package. Confirm developer dashboard's "Total Payouts" updates live (existing socket).

- [ ] **Step 4: If anything fails**

Each task above leaves a commit. Use `git log --oneline` to find the suspect task and re-read its steps. The most likely failures are:
- Step 5 forwarder: tiktok-backend's `DATACLAUS_APP_ID` env doesn't match the seeded TikTok Clone UUID (`b6ee3a76-5863-45f0-84cf-f10dd55423f5`). Fix the env, restart `:4001`.
- Step 7 extractor: the new SQL queries return zero rows. Check that demo-seed inserted into both `watch_events` and `user_profiles`.
- Step 14 modal: extractPreview response missing `dimensions` field. Inspect network tab; the backend may need a restart after the entity changes.

- [ ] **Step 5: No commit — this is a verification gate**

If everything passes, you're done. If not, fix forward — open new commits, don't amend.

---

## Self-Review Notes

- **Spec coverage:** All 11 acceptance criteria in spec §11 map to tasks: AC1→Task 4 (ingest endpoint), AC2→Tasks 2+3 (entities), AC3→Task 7 (extractor), AC4→Tasks 9+10 (evaluator + clamp), AC5→Tasks 8+11 (DataPackage column + persist), AC6→Task 14 (modal), AC7→Task 15 (detail page), AC8→Task 17 (headline packages), AC9→Task 19 (end-to-end), AC10→Task 18 (smoke), AC11→Task 19.
- **Backward compat:** Task 11 explicitly populates `claimedMetrics`/`schemaJson`/`sampleRows` from the device dimension so legacy buyer code keeps rendering. Task 14 keeps the flat-table fallback in the modal. Task 15 keeps the flat-table fallback on the detail page.
- **MVP discipline:** No tests for entities, DTOs, controllers, frontend components, or seed scripts. Tests exist for the pure-helper layer (Task 6) and extend the existing extractor spec (Task 7). The smoke test (Task 18) is the integration gate.
- **YAGNI:** No anti-bypass on watch events, no real recsys, no per-dim purchase, no S3 download, no Cinema+ behavior coverage, no real mobile signup form — all called out in spec §8 as v1.1.

---

## Execution Notes

This plan assumes a clean `develop` branch. Each task ends in a commit; if you abort mid-task, `git status` will show partial work and you can either commit-as-WIP or stash and resume.

The Gemini evaluator's per-dimension prompt has not been live-tested with real Gemini API calls during plan-writing — the prompt is structurally correct, but if Gemini returns wildly anchored numbers, the clamp logic in Task 10 catches it (±20% beyond band). Verify in Task 19 step 7 — if the live submission's per-dim prices look implausible, tighten the prompt's anchor wording in `package-evaluator.prompt.ts` (one-line iteration).
