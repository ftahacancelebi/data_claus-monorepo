# Behavior Graph + Content Data — Marketplace Pivot v2 (Design)

**Date:** 2026-05-21
**Owner:** taiko
**Status:** approved design, ready for implementation plan
**Scope:** Extends the auto-extract marketplace pivot ([2026-05-20-data-marketplace-auto-extract-design.md](./2026-05-20-data-marketplace-auto-extract-design.md)) so a `DataPackage` is no longer a single undifferentiated blob of `scored_events` but a **typed bundle of dimensions** (behavior, demographic, device), each independently sourced, sampled, AI-valued, and displayed to the buyer.
**Target:** demo-ready, ~2 working days from start; data fully seeded, pipeline real, recommendation stubbed.

---

## 1. Problem & Motivation

The marketplace pivot v1 showed that DataClaus can extract a real package from real telemetry and let Claude/Gemini certify it. The remaining gap is **product narrative**: every package today exposes the same single `scored_events` blob, which means a TikTok-like content app and a fitness tracker look identical on the marketplace — both sell "behavioral events", both are priced from the same `PRICE_BASELINE_USD_PER_ROW` table. A jury looks at this and asks: *what's the difference between apps then? They're all motion data.*

The truth is that apps differ in **what kinds of data they yield**. TikTok-style apps produce a content-affinity graph (who watched what, with what tags, for how long) plus pseudonymized demographics (age bucket + gender + locale from signup). A fitness app yields biometric + motion. An e-commerce app yields basket. A marketplace that hides this differentiation commoditizes its own inventory.

This pivot makes the differentiation **structural and visible**:

- Every package carries a `dimensions` map. Today the three dimensions are `behavior`, `demographic`, `device`. Not every app provides every dimension — a fitness app legitimately ships with only `device`.
- The Gemini auditor returns a **per-dimension unit price + quality score + justification** under bounded industry-anchor prompts.
- The buyer opens a package and sees an **itemized invoice**: behavior X events × $A = $X', demographic Y profiles × $B = $Y', device Z events × $C = $Z'. A TikTok-Clone package and a FitMove package sit next to each other in the marketplace with visibly different value, with the AI's justification quoted under each line.

What does NOT change: existing auto-extract entry (CreateFromAppModal, `/v1/applications/mine/eligible`, `/v1/applications/:id/extract-preview`), purchase + ledger settlement, seller-earnings live update. The pivot is additive on top of the v1 pipeline.

---

## 2. The Three Dimensions (Data Model)

| Dimension | Source table (dataclaus-core DB) | Sample fields | Why a buyer pays for it |
|---|---|---|---|
| **Behavior** | `watch_events` (new) — populated by tiktok-backend POST forwarder | `user_pseudo_id`, `video_id`, `tags[]`, `dwell_ms`, `completed`, `ts` | Content affinity, taste graph, creator-audience overlap |
| **Demographic** | `user_profiles` (new) — seeded directly | `age_bucket`, `gender`, `locale` (all pre-censored) | Audience segmentation, targeting, lookalike modeling |
| **Device** | `scored_events` (existing) | `quality_score`, `fraud_score`, `sensor_class`, `session_id` | Bot detection + quality certification underlying every other dimension |

**Censorship is enforced at extract time, not at storage time.** That is: `user_profiles` may hold a raw age in tiktok-backend (since signup collects it), but the extractor only ever passes the bucket forward. Rules:

| Field | Stored | Extracted |
|---|---|---|
| age | exact integer | bucket: `18-24`, `25-34`, `35-44`, `45-54`, `55+` |
| gender | `m`/`f`/`x`/`null` | same (already low-cardinality) |
| locale | full IETF tag (`tr-TR`) | country code only (`TR`) |
| user_id | UUID | `u_<sha256(user_id+app_id)[0:8]>` (matches v1 convention) |

`Behavior` and `Demographic` are TikTok-Clone-specific in this pivot. FitMove and Cinema+ stay device-only this iteration (Cinema+ gets behavior in v1.1 — same shape, different tag taxonomy). This is intentional: the dimension differential between apps is the story.

---

## 3. Architecture Changes

### 3.1 tiktok-backend (Node.js / NestJS) — stays stateless

**Verified state:** `tiktok-backend` today has zero database wiring. No TypeORM, no Postgres connection. `VideosService` reads `data/videos.json`; `userViews` and `userLikes` live in process-memory `Map`s. Every other service (`ads`, `auth`, `earnings`) is a thin proxy that calls `DATACLAUS_API_URL` over HTTP.

We keep that posture. Adding a database to tiktok-backend for a 2-day demo build is expensive infra (TypeORM setup, separate seed pass, separate migrations) and dilutes the "DataClaus is the system of record" narrative. Watch events and user profiles live in dataclaus-core's DB; tiktok-backend forwards them.

**Changes inside `apps/tiktok-backend/src/`:**

- **`Video` (in-memory + JSON):** extend the `Video` interface in `videos.service.ts` with `tags: string[]` and `category: string`. Update `data/videos.json` with the seeded 50 videos × tag assignments (see §5). Loader code already handles missing-fields gracefully (defaults to empty values).
- **`POST /videos/:id/view`** becomes a forwarding proxy. Today it mutates the in-memory `userViews` set. New behavior:
  1. Resolve `user_id` from Bearer token via `DataClausService.getUserProfile(token)` (already exists).
  2. POST to dataclaus-core: `POST {DATACLAUS_API_URL}/v1/internal/watch-events` with `{ app_id, user_id, video_id, dwell_ms, completed }`. App ID comes from `DATACLAUS_APP_ID` env var (already used by `ads`).
  3. Local in-memory `userViews` write stays (cheap, used by the `is_liked` UI hint in the feed — not extract-relevant).
- **No new entity files in tiktok-backend.** No database connection. Demographic profile data is not collected by tiktok-backend at all — it's seeded directly into dataclaus-core by `demo-seed.ts`.

Anti-bypass: deferred. The forwarder is open; watch events do not move money in this iteration. Slot/seal extension is a v1.1 hardening pass.

### 3.2 dataclaus-nestjs-api (NestJS core)

**Two new entities** in `apps/dataclaus-nestjs-api/src/modules/` (use existing TypeORM connection, `synchronize:true` in dev, migration file for prod):

- `WatchEvent` (`modules/watch-events/entities/watch-event.entity.ts`):
  ```
  id uuid PK
  application_id uuid (FK applications.id)
  user_id uuid (FK dataclaus_users.id)
  video_id text          -- matches tiktok-backend's videos.json id
  video_tags text[]      -- denormalized for extract-time filtering without a video-table join
  video_category text
  dwell_ms int
  completed bool
  recorded_at timestamptz default now()
  ```
- `UserProfile` (`modules/dataclaus-user/entities/user-profile.entity.ts`, sibling of existing `DataClausUser`):
  ```
  user_id uuid PK FK dataclaus_users.id
  age_bucket text   -- precomputed; no raw age column
  gender text       -- 'm'|'f'|'x'
  locale text       -- ISO country code
  created_at timestamptz default now()
  ```

**New endpoint** `POST /v1/internal/watch-events` (used only by tiktok-backend; auth = static `INTERNAL_INGEST_SECRET` header, defined in env, demo-acceptable for the docker-compose trust boundary; v1.1 promotes to slot/seal). Validates payload, looks up `video_tags`/`video_category` from `data/videos.json` (mirrored into a static map in the service to avoid a tiktok-backend round-trip), writes the row.

**`ApplicationExtractorService.extract(appId, dateRange)`** is the surface that needs to grow:

- It already aggregates `scored_events` for the device dimension. Keep that.
- For applications listed in `APP_DIMENSIONS` (see below), also aggregate `watch_events` and `user_profiles` locally — no HTTP calls to tiktok-backend at extract time.
- Returns a typed result:
  ```ts
  {
    behavior?: DimensionPayload,
    demographic?: DimensionPayload,
    device: DimensionPayload  // always present
  }

  DimensionPayload = {
    count: number
    sample_rows: object[]
    distribution?: Record<string, number>  // tag_distribution OR demo distribution
    schema_json: string  // JSON-stringified shape descriptor
  }
  ```
- Application-to-dimension config lives in `constants.ts`:
  ```ts
  APP_DIMENSIONS: Record<string, ('behavior' | 'demographic' | 'device')[]> = {
    'TikTok Clone': ['behavior', 'demographic', 'device'],
    'Cinema+ Streaming': ['device'],  // v1.1 will add behavior
    'FitMove Tracker': ['device'],
  };
  ```
  Looked up by app name to keep demo deterministic. v1.1 makes this a column on the `Application` entity.

**`DataPackage` entity (existing)** gets a new column:
- `dimensions jsonb null` — `Record<DimensionName, DimensionPayloadWithValuation>`
- `DimensionPayloadWithValuation = DimensionPayload & { unit_price_usd: number, quality_score: number, ai_justification: string, total_usd: number }`
- Backward compat: existing `claimed_metrics`, `schema_json`, `sample_rows` columns continue to be populated **from the device dimension** so old buyer code paths keep rendering. New code reads `dimensions` first, falls back to flat columns.

### 3.3 Extract-preview endpoint

`GET /v1/applications/:id/extract-preview` returns the same shape as today (`ExtractPreviewResponse`), but the `sample_rows` field is replaced by a structured `dimensions` map:

```ts
{
  app: { id, name, category },
  date_range: { from, to },
  dimensions: {
    behavior?: { count, distribution, sample_rows, schema_json },
    demographic?: { count, distribution, sample_rows, schema_json },
    device:     { count, distribution, sample_rows, schema_json }
  },
  suggested_title: string,
  suggested_category: string,
  // NOTE: suggested_price removed — pricing is now AI-driven, surfaced at submit time, not preview time
}
```

Frontend zod schema (`src/lib/schemas.ts`) updated; existing `ExtractPreviewResponseSchema` extended additively.

### 3.4 PackageEvaluatorService (Gemini auditor)

This is the AI-valuation centerpiece. Today the auditor scores a single package and returns one `trust_score` + summary. We extend the prompt to also return **per-dimension unit price + justification**.

The prompt is bounded with explicit market anchors so Gemini doesn't hallucinate orders of magnitude:

```
You are a data marketplace auditor. The package below contains up to three dimensions
of pseudonymized user data. For each dimension present, output:
  - quality_score (0.0–1.0): how rich, clean, and useful this dimension is
  - unit_price_usd: fair per-unit price in USD
  - ai_justification: one sentence citing what in the data drove the price

INDUSTRY ANCHOR RANGES (use as bounds, don't go outside without strong reason):
  - behavior (watch + engagement + tags): $1–10 per 1,000 events
  - demographic (censored age+gender+locale profiles): $5–50 per 1,000 profiles
  - device (sensor variance, bot/fraud signal): $0.50–5 per 1,000 events

Quality multipliers inside the band:
  - completion rate > 60% → push behavior toward $5–10/1k
  - tag diversity > 30 unique tags → push behavior toward upper band
  - bot-flagged fraction > 10% in device → push device toward lower band
  - demographic completeness < 80% → push demographic toward lower band

Output JSON only, no prose:
{
  "overall_trust_score": 0.0–1.0,
  "summary": "one-paragraph auditor note",
  "dimensions": {
    "behavior":    { "unit_price_usd": float, "quality_score": float, "ai_justification": "…" },
    "demographic": { "unit_price_usd": float, "quality_score": float, "ai_justification": "…" },
    "device":      { "unit_price_usd": float, "quality_score": float, "ai_justification": "…" }
  }
}
```

- Model: `gemini-1.5-pro` (already wired), `temperature: 0.2`, `responseMimeType: 'application/json'`.
- Determinism guard: if Gemini returns a unit price outside the anchor band ±20%, the service clamps to the nearest band edge and appends `(adjusted to industry band)` to the justification.
- **Fallback (no API key OR API timeout):** deterministic stub returns midpoint of each anchor band, justification = `"Auditor offline — defaulted to market median"`. The package is still listable, just unmistakably labeled as stub-priced.
- Total price computation lives in the service, not the LLM:
  ```ts
  total_usd_per_dim = (dim.count / 1000) * dim.unit_price_usd  // anchors are per-1k
  package.suggested_price_usd = sum(total_usd_per_dim across dimensions)
  ```

---

## 4. UX Changes

**Design discipline (carried from v1):** distinctive, info-dense, intentional typography. No stock SaaS card grids. Mono numerals for counts and money; small sans labels; inline state semantics (⚠ for low quality, $ visible without decoration).

### 4.1 `<CreateFromAppModal>` Step 2 — Preview

Replace the single sample table with **three column cards** when `extractPreview.dimensions` has > 1 key. Each card:

```
┌──────────────────────────────┐
│ BEHAVIOR                     │
│ 2,463 watch events           │  ← large mono
│ across 18 tags               │
│                              │
│ Top tags: dance · comedy ·   │  ← chips
│ gaming · beauty · vlog       │
│                              │
│ Sample (3 rows):             │
│ u_a8c1 → vid_42 · 12.4s · ✓ │  ← mono row
│ u_3f9b → vid_07 ·  2.1s     │
│ u_a8c1 → vid_19 · 18.7s · ✓ │
│                              │
│ Est. value: pending AI audit │  ← italic, dim
└──────────────────────────────┘
```

For apps with a single dimension (FitMove), the layout collapses to one centered card and the existing flat-sample table renders inside it (no regression on the v1 UX).

The `Submit for AI Evaluation →` button text doesn't change. After submit, the package goes into `evaluating` and the existing 2-second polling flips it to `certified` with the new dimension-level prices baked in.

### 4.2 Marketplace detail page (`/dashboard/marketplace/[id]`)

The buyer-facing inventory view — this is where the differentiation story lands. Three layout zones:

1. **Header** (unchanged): title, app name, trust gauge, purchase button.
2. **Dimension breakdown** (new) — grid of cards, one per dimension present. Each card:
   - Dimension label + count (mono)
   - 1-line AI quality verdict ("Strong completion rate, broad tag coverage")
   - Unit price line: `$0.0042 / event × 2,463 = $10.34`
   - AI justification, italicized, 1 sentence
3. **Total + comparison** (new): bottom strip shows total `$X`, and a small "Device-only would be: $Y · this package is N× richer" callout when ≥ 2 dimensions are present. This is the "what's the difference between apps" reveal.

Implementation: extend `usePackage(id)` to surface `package.dimensions`. New `<DimensionBreakdownCard>` component in `apps/dataclaus-web/src/components/marketplace/`. Existing single-sample-table preserved as the **device dimension** card content for backward compat with v1 packages that have no `dimensions` field.

### 4.3 List view

Marketplace package cards (`/dashboard/marketplace`) get small dimension chips under the title: `[behavior] [demographic] [device]`. FitMove cards show only `[device]` — the visual delta is the point. No price change in the list view; the AI-valued total is the same field that already renders.

---

## 5. Seed Strategy

`scripts/demo-seed.ts` extensions. Idempotent (matched by deterministic IDs).

### 5.1 Videos & tags

A fixed 20-tag taxonomy:
```
dance, comedy, gaming, beauty, food, fitness, vlog, asmr,
education, music, fashion, animals, travel, sports, art,
diy, news, lifestyle, finance, tech
```

50 seeded videos for TikTok Clone, each tagged with 1–3 tags from the taxonomy. URLs reuse the existing CDN refs in `data/videos.json` (or placeholder external URLs — videos aren't actually streamed during the marketplace demo, only their metadata is shown).

### 5.2 Watch events

For TikTok Clone:
- ~3,000 `WatchEvent` rows across the 5 seeded end-users × 50 videos
- Distribution: Alice favors `dance` + `beauty`, Bob favors `gaming` + `tech`, Cem favors `food` + `cooking`, etc. — gives the AI auditor a recognizable affinity pattern to praise
- `dwell_ms` realistic: completion videos 8–30s; bounce videos < 3s; ~10% bot-like (uniform 200ms dwell) to demonstrate the device-dimension's value as a filter
- Dates spread across the last 60 days

### 5.3 Demographic profiles

5 `UserProfile` rows, one per seeded end-user:
```
Alice  → 25-34, f, TR
Bob    → 25-34, m, TR
Cem    → 35-44, m, TR
Deniz  → 18-24, x, US
Elif   → 18-24, f, DE
```

Deliberately diverse on every axis so the buyer-side distribution chart has something to show.

### 5.4 New seeded packages

In addition to the existing 6 packages, seed 2 more that exercise the new dimensions:

| Title | App | Dimensions present | Trust | Why |
|---|---|---|---|---|
| TikTok Clone — Behavior & Demo Q1 | TikTok Clone | behavior + demographic + device | 0.91 | Headline package; the demo's centerpiece |
| FitMove — Device-Only Baseline | FitMove | device only | 0.87 | Side-by-side comparison anchor |

Both seeded with pre-computed `dimensions` payloads including AI-equivalent unit prices and justifications, so the marketplace looks populated even without running the live evaluator.

---

## 6. Demo Flow (jury script)

1. **Open** `/dashboard/marketplace` as `buyer.brandone`. Two new cards stand out: TikTok Clone (3 dimension chips) vs FitMove (1 chip). Story tee-up: *"Same marketplace, two apps, visibly different products."*
2. Click into **TikTok Clone — Behavior & Demo Q1**. Three dimension cards visible: Behavior $X · Demographic $Y · Device $Z. AI justification quoted under each. Total ≈ $250.
3. Click into **FitMove — Device-Only Baseline**. One dimension card. Total ≈ $40. The 6× value differential is now structurally explained, not assumed.
4. Switch tabs to developer view (`developer.social`). Demo step 2–4 from JURY_LOGIN.md: ✨ From an app → TikTok Clone → Extract preview shows three-card layout → Submit → ~5s evaluating → flips to certified. The new package appears in marketplace with AI-valued breakdown.
5. Buyer purchases the live-extracted package. Seller earnings update live on developer dashboard (existing socket path). Per-dimension prices visible in the receipt UI.

The "Claude/Gemini wrote this" moment is now also "Gemini priced this": the AI's justification under each dimension is the proof.

---

## 7. Pricing & The AI Valuator — Concrete Example

Example **live-extracted** package from `developer.social` running ✨ From an app → TikTok Clone → Last 30 days. Counts are sub-windows of the seeded totals (~2,463 of 3,000 watch events fall in the window; 5 of 5 profiles; 1,247 of ~1,400 device events).

| Dimension | Count | AI unit price | AI quality | AI justification | Dim total |
|---|---:|---:|---:|---|---:|
| Behavior | 2,463 | $0.0042 / event | 0.88 | "68% completion, 18-tag breadth, strong content affinity per user" | $10.34 |
| Demographic | 5 | $0.0235 / profile | 0.74 | "Small sample, but full coverage across age, gender, locale" | $0.12 |
| Device | 1,247 | $0.0019 / event | 0.81 | "Median fraud_score 0.86, ~9% bot-flagged rows correctly isolated" | $2.37 |
| | | | | **Total** | **$12.83** |

Demographic stays small ($0.12) at this seed scale because the seeded profile count is intentionally tiny (5 users) and the AI prices fairly accordingly. The narrative point is the **structure**, not absolute scale. The two pre-seeded headline packages (§5.4) use **hand-built `dimensions` payloads with inflated counts** (e.g., 2,100 demo profiles) so the marketplace list view shows a credible value differential on first glance — live-extracted packages reflect actual aggregate counts.

---

## 8. Scope — Non-Goals (explicit)

- **Real demographic capture on mobile signup.** The Expo app's signup screen stays as-is; demographic data is seeded directly into `UserProfile`. v1.1 adds a 1-step demographic form post-signup.
- **Real recommendation algorithm.** The feed remains linear (page/limit). Videos look tagged but the order doesn't change. No cosine-sim, no user × tag affinity matrix.
- **Anti-bypass for watch events.** `POST /videos/:id/view` stays open; the slot/seal pattern is not extended here. Watch events are not money-impacting (no payout per watch in this iteration).
- **Per-dimension purchase.** Buyer purchases a whole package. No "buy just behavior, skip device" path. v1.2.
- **S3 signed-URL download.** Inline JSON download stays the delivery mechanism, same as v1.
- **Cinema+ behavior coverage.** Cinema+ stays device-only in this iteration; v1.1 extends it with the same shape and a movie-tag taxonomy.
- **Mobile UI for tags.** The tiktok-mobile feed doesn't render tag chips on videos. (Cheap to add later if visually requested.)
- **Pricing UI controls.** The developer cannot override the AI-set price in this iteration. v1.1 may add a "request review" path.

---

## 9. Open Questions / v1.1

| Item | Why deferred | Trigger to revisit |
|---|---|---|
| Demographic signup in tiktok-mobile | Out of demo critical path; seed covers narrative | When a real user pool replaces seed |
| Per-app `dimensions` column on `Application` | Demo-deterministic config is enough; entity migration is bigger surface | When a second behavior-rich app ships |
| Anti-bypass slot/seal on `WatchEvent` | Watch events don't move money yet | When a per-watch payout model exists |
| Recommendation algo (tag-vector cosine sim) | Demo doesn't need it | When buyers start asking for "lookalike taste" packages |
| Gemini valuation drift / determinism over time | Single demo is unaffected; long-term needs A/B | When valuation becomes a contract guarantee |
| Compliance modal at purchase | KVKK/GDPR consent UX not in demo critical path | Before any real (non-seeded) user data enters |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Gemini returns wild per-dim prices that break the layout | Anchor bounds in prompt + ±20% clamp in service; stub fallback |
| Watch event payload trust at the tiktok-backend → core boundary | Static `INTERNAL_INGEST_SECRET` header in `.env` for v1; v1.1 promotes to slot/seal HMAC the way `/ads/impression` already works |
| Live extract round-trip blows past 3s SLA | Cache the aggregate query per app per range for 60s in extractor service |
| Seeded `UserProfile` count (5) makes demographic dim look tiny in live-extract | Seeded headline package uses hand-built dimension payloads; live extract acknowledges low N in its justification |
| Existing v1 packages without `dimensions` column break marketplace detail | Frontend falls back to flat `sample_rows`/`schema_json` if `dimensions === null`; backward compat verified |

---

## 11. Acceptance Criteria

- [ ] `dataclaus-nestjs-api` boots with `watch_events` and `user_profiles` tables (synchronize:true in dev); migration file added for prod.
- [ ] `POST /v1/internal/watch-events` accepts the documented payload behind `INTERNAL_INGEST_SECRET`; tiktok-backend's `/videos/:id/view` forwards a row per view.
- [ ] `ApplicationExtractorService.extract('TikTok Clone', …)` returns all three dimensions populated; for FitMove returns only `device`.
- [ ] `PackageEvaluatorService` returns per-dimension unit price + justification; clamp logic engages when Gemini exceeds bounds; stub fallback labeled in justification.
- [ ] `DataPackage.dimensions` jsonb populated on submit; `claimed_metrics`/`schema_json`/`sample_rows` also populated from the device dimension for backward compat.
- [ ] CreateFromAppModal Step 2 renders three-card layout when ≥ 2 dimensions present; collapses to single-card for FitMove without regression.
- [ ] Marketplace detail page renders dimension breakdown cards with AI unit price + justification quoted.
- [ ] Two new seeded packages (TikTok Clone headline + FitMove baseline) visible on `/dashboard/marketplace` after `pnpm run demo:seed`, with dimension chips on the list cards.
- [ ] Live submission flow (auto-extract → submit → certified → buyer purchase → seller earnings) works end-to-end with the new shape.
- [ ] `pnpm exec ts-node scripts/smoke-test-package-marketplace.ts` passes against TikTok Clone (validates the multi-dimension path).

---

*This spec supersedes the dimension-flat assumption in [2026-05-20-data-marketplace-auto-extract-design.md §2](./2026-05-20-data-marketplace-auto-extract-design.md). The v1 spec's UX, endpoints, and ledger semantics remain authoritative for everything else.*
