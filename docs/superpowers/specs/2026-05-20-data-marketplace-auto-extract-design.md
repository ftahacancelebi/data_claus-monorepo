# Data Marketplace — Auto-Extract from App (Design)

**Date:** 2026-05-20
**Owner:** taiko
**Status:** approved design, ready for implementation plan
**Scope:** Adds an "auto-package from an existing application" flow to the data marketplace pivot ([memory-bank/implementation/08-data-package-marketplace-pivot.md](../../../memory-bank/implementation/08-data-package-marketplace-pivot.md)).
**Target:** demo-ready, 2 working days from start.

---

## 1. Problem & Motivation

The marketplace MVP currently asks developers to submit a data package by **pasting JSON schema and 5–10 sample rows into textareas**. This works mechanically, but for a jury demo it tells the wrong story: it makes the developer look like the one doing the data work, when the actual product story is "DataClaus already has your behavioral telemetry; we package and grade it for you."

We pivot the submission UX to the **magic story**: a developer picks one of their existing apps; the platform aggregates the app's real telemetry (`scored_events` enriched by `ad_impressions`), anonymizes a sample, suggests title/category/price, and hands the developer a one-click submit. The existing AI-evaluation, listing, purchase, and ledger-settlement flows behind it are untouched.

Why this story wins:
- Leverages real seeded behavioral data the platform already collects.
- The AI auditor moment is stronger when the sample contains real bot-like rows the seed already plants (~15%) — Claude actually catches them.
- No JSON pasting on stage, no typing risk, no demo-stopping form errors.
- Zero breaking change to existing `POST /v1/packages` flow; entirely additive.

---

## 2. Core Mechanic & Data Source

**A package = aggregate of `scored_events` for one application over a date range, optionally enriched with `ad_impressions` financial overlay.**

`scored_events` is the right source because each row already contains a behavioral event (`accelerometer`, `gyroscope`, `touch`, `scroll`, `screen_view`) plus a `quality_score` / `fraud_score` — the exact signals a buyer (advertiser/data co.) would pay for, and the exact signals the LLM auditor was designed to grade. `ad_impressions` is too narrow (monetary only) as the primary source, but its presence enriches `claimed_metrics`.

What an auto-extracted package contains:

| Field | Source | Example |
|---|---|---|
| `claimed_metrics.row_count` | `COUNT(scored_events WHERE app_id=X AND created_at IN range)` | 12,847 |
| `claimed_metrics.unique_users` | `COUNT(DISTINCT user_id …)` | 412 |
| `claimed_metrics.date_range_start/end` | `MIN/MAX(created_at)` clamped to the requested range | 2025-10-04 → 2025-11-30 |
| `schema_json` | Fixed shape derived from `scored_events` columns: `{user_pseudo_id, event_type, sensor_class, quality_score, session_id, recorded_at}` | (constant) |
| `sample_rows` | 8 stratified rows: 6 with `quality_score >= 0.6`, 2 with `< 0.6`; `user_id` → `u_<sha256(user_id+app_id)[0:8]>` | (anonymized, deterministic per-user) |
| Suggested category | Event-type distribution: `accelerometer+gyroscope` → fitness, `scroll+screen_view` → social, etc. Fallback to `app.category`. | `social` |
| Suggested price | `row_count × PRICE_BASELINE_USD_PER_ROW[category]`, rounded to 2 decimals | $89.00 |
| Suggested title | `${app.name} ${capitalize(category)} Telemetry Q${q} ${year}` | "TikTok Clone Social Telemetry Q4 2025" |

After purchase, the buyer's `/v1/packages/:id/download` returns the same anonymized `sample_rows` JSON as today (MVP — S3 signed-URL delivery stays deferred per the parent pivot spec §10).

**Rejected alternatives:**
- *Only `ad_impressions`*: schema too narrow, no behavioral signal, no bot-pattern indicator for the LLM to catch.
- *Synthetic generator*: produces credible volume but is detectably patterned and weakens the "real data" pitch.

---

## 3. UX Design

**Design discipline:** distinctive, info-dense, intentional. No generic SaaS hero/centered-card/emoji-decoration templates. Use existing primitives (`glass-panel`, `<DataclausScoreGauge>`) but composed with typography contrast (mono pseudo-IDs, real timestamps), inline state semantics (⚠ on flagged sample rows), and copy that says what the thing does.

### 3.1 Entry — `/dashboard/packages`

Existing list view unchanged except the primary CTA:

```
[+ New Package ▼]
   ├── ✨ From an app           ← new default
   └── From scratch (advanced)  ← existing JSON form, secondary
```

### 3.2 `<CreateFromAppModal>` — 2-step modal

A single modal that flips between two states. Modal (not a separate page) so the jury sees the entire flow in one continuous frame.

**Step 1 — App picker** (loaded immediately from `GET /v1/applications/mine/eligible`):

- Radio list of the developer's apps, each row showing inline metadata: `name · ~N unique users · ~M events` (from the eligibility aggregate).
- Apps with `eligible: false` are disabled with a one-line reason ("Needs at least 100 events to package — has 47").
- Date-range select: `Last 30 days` (default), `Last 7 days`, `Last 90 days`, `Custom…`.
- Primary action: `Extract preview →`.

**Step 2 — Preview & confirm** (loaded from `GET /v1/applications/:id/extract-preview`):

- Header block: row count, unique users, date range, auto-detected category — laid out as a typographically contrasted info row (large numerals in mono, labels in small sans), not a stock stats card.
- Sample table (8 rows): mono pseudo-IDs (`u_a8c1…`), event type, quality score, session id. Rows with `quality_score < 0.3` get an inline `⚠` glyph and amber row tint — implicit setup for the LLM's later "bot signature" red flag.
- Editable fields: `title` (pre-filled with suggested), `price` (pre-filled with suggested; small label "💡 Suggested $X based on category baseline" below the input).
- Primary action: `Submit for AI Evaluation →` → calls existing `POST /v1/packages` with the draft as body, redirects to `/dashboard/packages/:id` (existing evaluating spinner).
- Secondary: `← Back` to step 1.

### 3.3 What stays unchanged

- `/dashboard/packages/new` (the JSON-textarea form) survives as `From scratch (advanced)` — for the rare custom-data path and as a fallback if the modal errors.
- `/dashboard/packages/:id` evaluation spinner + certified/rejected flip — no change.
- `/dashboard/marketplace`, `/marketplace/:id`, purchase, ledger settlement, realtime balance update — no change.

### 3.4 Edge case — developer has no apps

Step 1 shows: `You don't have any apps yet — [Create one] or [Submit from scratch]`. Not on the demo path (all three demo developers have apps); included for production hardening.

---

## 4. Backend Architecture

### 4.1 Module layout

New sub-module inside `data-packages`:

```
apps/dataclaus-nestjs-api/src/modules/data-packages/
└── extractor/
    ├── application-extractor.service.ts    [new]
    ├── extractor.controller.ts             [new]
    ├── extractor.constants.ts              [new — PRICE_BASELINE_USD_PER_ROW]
    └── dto/
        ├── extract-preview.dto.ts          [new — ExtractedPackageDraftDto]
        └── eligible-application.dto.ts     [new — EligibleApplicationDto]
```

Existing files (`data-packages.controller.ts`, `data-packages.service.ts`, `package-evaluator.service.ts`, entities) are **not modified**. The extractor is read-only and produces a draft that conforms to the existing `CreatePackageDto`.

### 4.2 New endpoints (additive, read-only)

| Method | Path | Auth | Query / Body | Returns |
|---|---|---|---|---|
| `GET` | `/v1/applications/mine/eligible` | developer | — | `EligibleApplicationDto[]` |
| `GET` | `/v1/applications/:id/extract-preview` | developer (owner) OR admin | `?from=ISO&to=ISO` (both optional, default last 30d) | `ExtractedPackageDraftDto` |

Both endpoints are idempotent and side-effect-free. The actual package creation still happens via the existing `POST /v1/packages` — the frontend holds the draft in component state and posts it on the user's "Submit" click.

### 4.3 `ExtractedPackageDraftDto` shape

```ts
export class ExtractedPackageDraftDto {
  // Fields that map 1:1 to CreatePackageDto for submit
  title: string;
  category: PackageCategory;
  claimed_metrics: {
    row_count: number;
    unique_users: number;
    date_range_start: string;  // ISO date
    date_range_end: string;    // ISO date
  };
  schema_json: Record<string, string>;
  sample_rows: Array<Record<string, unknown>>;
  price: number;

  // UI-only metadata (ignored by POST /v1/packages)
  application_id: string;
  application_name: string;
  ui_meta: {
    suggested_price_basis: string;   // "social baseline × 12,847 rows"
    flagged_sample_count: number;    // count of rows with quality_score < 0.3
    coverage_warning?: string;       // "Range covers 28 of 30 requested days"
  };
}
```

### 4.4 `ApplicationExtractorService.extract()` algorithm

1. Load app + ownership check (developer can only extract their own apps; admin can extract any).
2. Resolve date range — default `to = now`, `from = now − 30d`. Reject `from > to` and future dates.
3. Run a single aggregate query against `scored_events`:
   ```sql
   SELECT COUNT(*) AS row_count, COUNT(DISTINCT user_id) AS unique_users,
          event_type, COUNT(*) AS type_count
   FROM scored_events
   WHERE application_id = $1 AND created_at BETWEEN $2 AND $3
   GROUP BY event_type;
   ```
4. Enforce minimum thresholds: `row_count >= 100` (extraction viability) AND `unique_users >= 5` (privacy guardrail). Either failure → 400 with a specific message.
5. Stratified sample (8 rows): 6 where `quality_score >= 0.6` ORDER BY `RANDOM()` LIMIT 6, plus 2 where `quality_score < 0.6` ORDER BY `RANDOM()` LIMIT 2. `RANDOM()` ensures different samples on repeated calls (no jury déjà vu). Note: `md5(id || now()::text)` would NOT work — Postgres `now()` is transaction-scoped, producing identical hashes within a single call.
6. Anonymize: `user_id → u_${sha256(user_id + app_id).slice(0,8)}`. Salting with `app_id` means the same real user gets distinct pseudo-IDs across apps (privacy hygiene).
7. Derive suggested category from the event-type distribution; suggested price from `row_count × PRICE_BASELINE_USD_PER_ROW[category]`; suggested title from `${app.name} ${capitalize(category)} Telemetry Q${quarter} ${year}`.
8. Return the draft.

### 4.5 Category & price baseline tables

```ts
// extractor.constants.ts
export const PRICE_BASELINE_USD_PER_ROW: Record<PackageCategory, number> = {
  fitness:       0.0008,
  social:        0.0003,
  finance:       0.0050,
  entertainment: 0.0004,
  health:        0.0012,
  location:      0.0006,
  productivity:  0.0005,
  other:         0.0004,
};

export const EVENT_TYPE_TO_CATEGORY: Record<string, PackageCategory> = {
  accelerometer: 'fitness',
  gyroscope:     'fitness',
  scroll:        'social',
  screen_view:   'social',
  touch:         'entertainment',
};
```

The baseline table aligns with the LLM evaluator's `price_fairness` rubric (`apps/dataclaus-nestjs-api/src/modules/data-packages/package-evaluator.prompt.ts`) so suggested prices won't get docked.

### 4.6 LLM prompt addendum

Add one line to the evaluator prompt so Claude doesn't false-positive on pseudonymization:
> "Note: user IDs in sample rows may be pseudonymized as `u_<hex>`; this is privacy hygiene, not a red flag."

### 4.7 Index requirement

If not already present, add migration:
```sql
CREATE INDEX IF NOT EXISTS idx_scored_events_app_created
  ON scored_events (application_id, created_at);
```
Verifies the aggregate query is index-served.

### 4.8 Seed update

`scripts/demo-seed.ts` → `seedScoredEvents`:
- Bump count threshold from 50 → **3,000** (≈1,000 rows per app).
- **Synthetic user UUIDs** — instead of cycling through the 5 real `DEMO_USERS`, generate 100 deterministic pseudo-user UUIDs via `uuid5('demo-user-${i}', DEMO_NAMESPACE)` for i 0…99. `scored_events.user_id` has no FK constraint so this is valid. Result: each app shows ~100 unique users in the extract-preview (credible for a demo without seeding 100 real developer accounts).
- Spread `created_at` across the last 60 days (was a single point).
- Keep bot-pattern ratio at ~15% (every 7th row) — required for the LLM to catch in samples.
- Use TypeORM bulk `insert()` instead of per-row `save()` to keep seed runtime under 15s.

### 4.9 Errors

| Condition | Response |
|---|---|
| App not found | `404 NotFound` |
| App owned by another developer (non-admin) | `403 Forbidden` |
| `from > to` or future date | `400 BadRequest` |
| `row_count < 100` | `400 BadRequest` with specific message |
| `unique_users < 5` | `400 BadRequest` with privacy guardrail message |

---

## 5. Frontend Contract

### 5.1 New schemas (`src/lib/schemas.ts`)

- `EligibleApplicationSchema` — `{ id, name, category, event_count, unique_users, eligible, reason? }`
- `ExtractedPackageDraftSchema` — mirrors §4.3 DTO

### 5.2 New api functions (`src/lib/api.ts`)

- `listEligibleApplications(): Promise<EligibleApplication[]>`
- `extractPackagePreview(appId, { from?, to? }): Promise<ExtractedPackageDraft>`

Both call through the existing `request<T>()` with `schema:` validation.

### 5.3 New hooks (`src/lib/api-hooks.ts`)

- `useEligibleApplications()` — `useQuery` keyed by `queryKeys.applications.eligible()`
- `useExtractPreview()` — `useMutation` (not a query, because date range is user-chosen and we want explicit invocation). Returns the draft for component state.

### 5.4 New query keys (`src/lib/query-keys.ts`)

- `applications.eligible()`
- `extractor.preview(appId, range)` — reserved if we later cache previews (MVP does not)

### 5.5 New component

`src/components/packages/CreateFromAppModal.tsx` — 2-step controlled modal. Uses existing dialog primitives. Internal state: `step: 'pick' | 'preview'`, `selectedAppId`, `dateRange`, `draft`, `title`, `price`.

### 5.6 Page change

`src/app/dashboard/packages/page.tsx` — replace the `[+ New Package]` button with a dropdown trigger that opens either the new modal (default) or routes to `/dashboard/packages/new` (advanced).

### 5.7 No changes to

`useCreatePackage`, `usePackage`, `usePackages`, `useMyPackages`, `usePurchasePackage`, `useMyPurchases`, `<DataclausScoreGauge>`, `lib/route-guards.tsx`, marketplace pages, purchase flow, sidebar nav.

---

## 6. Demo Arc (~4 minutes)

| Time | Actor | Action | What the jury sees |
|---|---|---|---|
| 0:00 | Presenter | "AI-validated B2B data marketplace." | Direct platform login, no slide |
| 0:15 | Developer | Login → `/dashboard/packages` | 6 seeded packages, including one 0.94 certified, one 0.42 rejected — marketplace already has inventory |
| 0:45 | Developer | `[+ New Package ▼]` → `✨ From an app` | Modal opens, Step 1 |
| 0:55 | Developer | Pick `TikTok Clone` (~100 users · ~1,200 events), `Last 30 days`, `Extract preview` | 300ms aggregation; modal flips to Step 2 |
| 1:05 | — | Preview render: ~1,200 rows, ~100 users, sample table with one `quality: 0.12 ⚠` row, suggested title + suggested price | First wow: real data extracted from the app on screen |
| 1:20 | Developer | Adjust title slightly, price $89 → $87.50, `Submit for AI Evaluation` | POST `/v1/packages` → status `evaluating` → redirect |
| 1:25 | — | Package detail page: spinner + "DataClaus AI is reading your package…" | 3–5s genuine wait |
| 1:35 | — | Status flips to `● Certified · 0.86` with Claude's 2-sentence summary + 1 red flag ("Subtle bot-like pattern in 1 sample row — flagged but accepted") + 5 rubric bars | Wow: Claude wrote that summary live; it caught the bot row |
| 2:05 | Buyer (other tab) | Login → `/dashboard/marketplace` | New package is at the top by score |
| 2:25 | Buyer | Open detail → `Purchase for $87.50` → confirm | Confirmation, ledger entry visible |
| 3:00 | Developer (back to seller tab) | — | Wallet card updates real-time: balance increases by $78.75 via the existing socket→cache pattern, no refresh |
| 3:15 | Presenter | "AI graded it, buyer read it, money landed. 3 minutes." | Close |
| 3:30 | Optional | Admin → rejected (0.42) package detail → LLM eval JSON | "Claude found the bot pattern in plain English" |

---

## 7. Fallback Matrix

| Risk | Likelihood | Plan B |
|---|---|---|
| `extract-preview` slow (>1.5s) | low | Pre-warm DB; spinner is acceptable |
| `extract-preview` 500 error | low | Modal shows error + "Try from scratch" link → existing JSON form |
| Anthropic API down or slow (>8s) on live submit | low–medium | Existing `PackageEvaluatorService` already has a deterministic fallback eval (parent spec §6e); status flips, jury can't tell. **Must be smoke-tested before demo.** |
| Anthropic returns unparseable JSON | low | Existing retry-once-then-reject flow; if it triggers live, presenter pivots to a seeded 0.94 package narrative |
| WebSocket disconnect → no real-time balance update | low | Reconnect-safety-net already invalidates queries; F5 is a presenter-acceptable fallback |
| Seed corrupted / DB empty before demo | medium | `pnpm run demo:reset && pnpm run demo:seed` rebuilds in ~30s |
| Internet down (Anthropic unreachable) | low | All seeded packages have pre-computed evals; live submit falls back to deterministic eval; visually identical |

**T-30 minute pre-demo checklist:**
1. `pnpm run demo:reset && pnpm run demo:seed` → regenerate `JURY_LOGIN.md`.
2. Backend (`pnpm run dev:api`) + frontend (`pnpm run dev:web`) running.
3. `pnpm run smoke:package-marketplace` (extended e2e) all green.
4. One full manual rehearsal: extract → submit → buyer purchase → seller balance update.
5. `ANTHROPIC_API_KEY` valid and quota healthy.
6. Three browser tabs pre-logged-in: developer, buyer, admin.
7. WiFi backup ready.

---

## 8. Implementation Phases

### Phase A — Backend (~3h)
- [ ] Create `data-packages/extractor/` sub-module: service, controller, DTOs, constants.
- [ ] Add `idx_scored_events_app_created` migration (if not present).
- [ ] Update `seedScoredEvents` count threshold 50 → 3,000, spread `created_at` across 60 days.
- [ ] Append the pseudonymization note to the LLM evaluator prompt.
- [ ] Unit tests for `ApplicationExtractorService` (happy path, threshold, anonymization determinism, category & price suggestion).
- [ ] e2e test: `/v1/applications/mine/eligible` and `/v1/applications/:id/extract-preview` (owner + non-owner + admin cases).
- [ ] Manual integration: extract → POST → eval → certified.

### Phase B — Frontend (~4h)
- [ ] Add `EligibleApplicationSchema` and `ExtractedPackageDraftSchema` to `src/lib/schemas.ts`.
- [ ] Add `listEligibleApplications`, `extractPackagePreview` to `src/lib/api.ts`.
- [ ] Add `useEligibleApplications`, `useExtractPreview` to `src/lib/api-hooks.ts`.
- [ ] Add `applications.eligible` key to `src/lib/query-keys.ts`.
- [ ] Build `<CreateFromAppModal>` (2-step, info-dense, niche design).
- [ ] Wire dropdown trigger into `/dashboard/packages/page.tsx`.
- [ ] Keep `/dashboard/packages/new` intact as the secondary "advanced" path.
- [ ] Manual smoke + one rehearsal pass with each demo developer account.

### Phase C — Demo polish (~2h)
- [ ] Verify bot-pattern rows actually appear in stratified samples.
- [ ] Verify score-gauge animation triggers on first render.
- [ ] Rehearse the live timing with `JURY_LOGIN.md` credentials.
- [ ] Confirm `From an app` works for all three demo developers.

### Phase D — Docs (~1h)
- [ ] Update `JURY_LOGIN.md` with the `✨ From an app` instruction.
- [ ] Suggest a memory-bank update to `08-data-package-marketplace-pivot.md` adding the extractor section (suggestion only, taiko approves).

---

## 9. Acceptance Criteria

This design is implemented when:

1. A developer can pick one of their apps, see a real preview of an extracted package (real `scored_events` aggregation, anonymized sample), and submit it for AI evaluation in fewer than 30 seconds.
2. The submitted package is graded by Claude live (or the deterministic fallback), arriving at `certified` or `rejected` within 8 seconds.
3. The full demo arc (§6) runs end-to-end in under 4 minutes without manual SQL, DevTools, or terminal commands.
4. The existing JSON-paste flow at `/dashboard/packages/new` remains functional as a secondary "advanced" path.
5. No regression in marketplace browse, purchase, ledger settlement, or real-time seller wallet update.
6. Eligibility, ownership, and privacy guardrails (min rows, min users, ownership check) all enforced on the backend, surfaced in the modal.

---

## 10. Explicitly Out of Scope

- File upload (CSV/JSON drag-drop).
- Template chooser.
- Real-time pull from external app APIs.
- S3 signed-URL buyer download.
- Custom event-type filter UI.
- Multi-app combined packages.
- Scheduled package re-extraction.
- `data_packages.source: 'extracted' | 'manual'` differentiation in admin view.
- Production observability hooks specific to the extractor.

---

## 11. Open Questions (resolved during brainstorming)

1. **Data source:** `scored_events` (chosen — A) over `ad_impressions` alone (B) or synthetic (C).
2. **Demo story:** Auto-package from app (chosen — A) over file upload (B), templates (C), or polish-existing-form (D).
3. **Eligibility check:** Inline in modal, with a disabled-row + reason pattern.
4. **Bot row indicator in preview:** Yes — `⚠` glyph on rows with `quality_score < 0.3`.
5. **Modal vs page:** Modal — preserves the continuous demo frame.
6. **Endpoint shape:** Two read-only endpoints (eligible list, extract preview); existing `POST /v1/packages` unchanged.

---

## 12. References

- Parent pivot spec: `memory-bank/implementation/08-data-package-marketplace-pivot.md`
- Active context with marketplace audit: `memory-bank/activeContext.md` (§ 2026-05-16 entries)
- Existing data-packages module: `apps/dataclaus-nestjs-api/src/modules/data-packages/`
- Existing scored_events entity: `apps/dataclaus-nestjs-api/src/modules/ingest/entities/scored-event.entity.ts`
- Demo seed: `scripts/demo-seed.ts` (`seedScoredEvents`, `seedDataPackages`)
- Frontend frontend-flow discipline: project `CLAUDE.md` § "Frontend Discipline"
