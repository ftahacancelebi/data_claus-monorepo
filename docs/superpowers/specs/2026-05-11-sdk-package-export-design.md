# SDK Data-Package Export — Design Spec

**Date:** 2026-05-11
**Status:** approved (taiko), ready for implementation plan
**Scope:** MVP — fits the data-marketplace pivot (`memory-bank/implementation/08-data-package-marketplace-pivot.md`)
**Target package:** `@dataclaus/sdk-node`
**Backend impact:** zero schema change, zero new endpoint
**Frontend impact:** none required (optional polish only)

---

## 1. Problem

The marketplace pivot lets developers sell behavioral-data packages. Today the only way to create a package is the web form at `/dashboard/packages/new`, where the developer pastes 5–10 sample rows of JSON, types a schema dictionary, and computes `claimed_metrics` (row_count, unique_users, date range) by hand.

For any real dataset (thousands of rows), this is unusable. Developers need a programmatic path that:

1. Reads rows from **their own backend / database** (DataClaus is not the source of truth for raw data — the developer is).
2. Lets them **select** what to package — by SQL/query in their own code.
3. Supports an **auto-export** mode — a recurring upload (e.g. weekly) triggered by their own cron.
4. Hides the boring parts: schema dictionary, sample selection, metrics computation.

This spec adds a `DataClausPackager` class to `@dataclaus/sdk-node` that wraps the existing `POST /v1/packages` endpoint with that ergonomics.

---

## 2. Non-goals (out of MVP scope)

- DataClaus-side scheduler / cron infrastructure (developers run their own cron).
- Streaming or incremental upload — rows are always a full batch in one call.
- Encrypted upload / S3 signed URLs / chunked transfer.
- A new mobile SDK feature — `sdk-react-native` does not participate; mobile data flows to the developer's backend as it already does, and the developer's server is what calls `DataClausPackager`.
- Field-level PII masking / redaction (developer handles in their own query).
- A new "Schema Builder" UI.
- Long-lived API-key auth specifically for `/v1/packages` (we reuse standard JWT for MVP).

---

## 3. Architecture & data flow

```
Developer DB (Postgres / MySQL / anything)
        │
        │ SELECT ...   ← "selection" lives in the developer's own query
        ▼
Developer's cron / one-shot script (Node.js)
        │
        │ rows: Record<string, unknown>[]
        ▼
@dataclaus/sdk-node  →  DataClausPackager
        │
        ├─ inferSchema(rows)         (auto)
        ├─ pickSampleRows(rows, 8)   (auto, seeded)
        ├─ computeClaimedMetrics(rows, opts)  (auto)
        ├─ zod validate
        └─ POST /v1/packages   (Bearer JWT)
        ▼
DataClaus API  (unchanged: data-packages.controller.ts + service)
        ▼
PackageEvaluatorService  →  Claude  →  certified | rejected
        ▼
Marketplace listing visible at /marketplace/:id
```

Two operational modes use the same pipeline:

- **Selective (one-shot)** — developer calls `packager.create({...})` directly with full inputs. Equivalent to filling the web form, but programmatic.
- **Auto / recurring** — developer defines a template once (`packager.recurring({...})`), and a cron job calls `exporter.publish(rows)` on a schedule. The template auto-fills title (from a template string + computed date range), price, schema, metrics.

The selection mechanism is the developer's own SQL / query. The SDK does not provide a query builder.

---

## 4. SDK API

New file: `packages/sdk-node/src/packager.ts`.

```ts
import type { ClaimedMetrics, PackageStatus } from './types';

export interface PackagerConfig {
  apiUrl: string;            // e.g. http://localhost:3002 or https://api.dataclaus.io
  authToken: string;         // Bearer JWT for a developer/admin user
}

export class DataClausPackager {
  constructor(config: PackagerConfig);

  /**
   * Convenience for demos / scripts: exchanges email+password for a JWT
   * by calling the existing /auth/login endpoint, then returns a ready
   * Packager. Not recommended for long-running processes — prefer
   * passing `authToken` directly from a secrets manager.
   */
  static login(opts: {
    apiUrl: string;
    email: string;
    password: string;
  }): Promise<DataClausPackager>;

  /**
   * Selective / one-shot create. Developer supplies rows; SDK auto-fills
   * sample_rows, schema_json, and claimed_metrics unless overridden.
   */
  create(input: CreatePackageInput): Promise<CreatePackageResult>;

  /**
   * Build a recurring template. The returned exporter can be invoked
   * repeatedly (e.g. by the developer's cron) with new row batches.
   * Title / metrics / sample / schema are recomputed per call.
   */
  recurring(template: RecurringTemplate): RecurringExporter;
}

export interface CreatePackageInput {
  title: string;
  category: string;                          // 'fitness' | 'social' | 'finance' | ...
  description?: string;
  rows: Record<string, unknown>[];           // full dataset; min 5 rows (API requirement)
  price: number;
  applicationId?: string;
  userField?: string;                        // for unique_users metric (default heuristic)
  timestampField?: string;                   // for date_range metric (default heuristic)
  schemaJson?: Record<string, string>;       // override auto-infer
  claimedMetrics?: ClaimedMetrics;           // override auto-compute
}

export interface CreatePackageResult {
  id: string;
  status: PackageStatus;                     // 'evaluating' on success
}

export interface RecurringTemplate {
  category: string;
  basePrice: number;
  titleTemplate: string;                     // e.g. "Fitness Data — {start} to {end}"
  description?: string;
  applicationId?: string;
  userField?: string;
  timestampField?: string;
}

export class RecurringExporter {
  publish(rows: Record<string, unknown>[]): Promise<CreatePackageResult>;
}
```

Pure helpers are also exported for advanced composition:

```ts
export function inferSchema(rows: Record<string, unknown>[]): Record<string, string>;
export function pickSampleRows(rows: Record<string, unknown>[], n?: number): Record<string, unknown>[];
export function computeClaimedMetrics(
  rows: Record<string, unknown>[],
  opts?: { userField?: string; timestampField?: string },
): ClaimedMetrics;
```

The `index.ts` adds:

```ts
export {
  DataClausPackager,
  RecurringExporter,
  inferSchema,
  pickSampleRows,
  computeClaimedMetrics,
  type PackagerConfig,
  type CreatePackageInput,
  type CreatePackageResult,
  type RecurringTemplate,
} from './packager';
```

---

## 5. Auth

`POST /v1/packages` requires a Bearer JWT with role `developer` or `admin` (see `data-packages.controller.ts`). The SDK supports two ways to obtain that token:

1. **Direct token** — caller passes `authToken` (recommended for production-style use; pull from secrets manager).
2. **`DataClausPackager.login({ email, password })`** — convenience for demos. Calls `POST /auth/login` with `credentials: 'include'` not relevant for SDK (no browser); reads the `accessToken` from the JSON body and uses it as the Bearer.

Backend changes: **none**. Existing `/auth/login` and `POST /v1/packages` are reused as-is.

Token storage and refresh are the caller's responsibility. The SDK does not store credentials. If a call returns 401, the SDK throws a typed `PackagerAuthError`; the caller decides whether to re-login.

---

## 6. Inference rules

### 6.1 `inferSchema`

Walks at most the first 100 rows. For each field, gathers all observed types and reduces to a single string:

| Observed value | Inferred type |
|---|---|
| `null` / `undefined` | (skipped for that field on this row) |
| `boolean` | `boolean` |
| `number` (finite) | `number` |
| `string` matching ISO 8601 date or datetime regex | `timestamp` |
| `string` (other) | `string` |
| `Array` or `object` | `json` |
| Mixed types across rows for the same field | `string` (lossy fallback) |

If a field is never present, it is omitted from `schema_json`. Output is a plain `Record<string, string>` matching the backend DTO.

### 6.2 `pickSampleRows`

- Default `n = 8` (API allows 5–10; 8 leaves headroom on both sides).
- If `rows.length < 5`, throws `PackagerValidationError('need at least 5 rows; API minimum')`.
- If `rows.length >= n`, picks `n` rows using a seeded PRNG (seed = `rows.length`). Same input → same sample, makes test runs deterministic.
- If `5 <= rows.length < n`, returns all rows (cannot up-sample; never duplicates rows).
- Strips `undefined` values per row (JSON serialization safety).

### 6.3 `computeClaimedMetrics`

```ts
{
  row_count: number;          // rows.length
  unique_users: number;       // new Set(rows.map(r => r[userField])).size
  date_range_start: string;   // ISO date (YYYY-MM-DD) — min over rows[timestampField]
  date_range_end: string;     // ISO date — max over rows[timestampField]
}
```

Field resolution order:

- `userField` explicit > `'user_id'` > `'userId'` > `'external_user_id'` > `'externalUserId'`
- `timestampField` explicit > `'timestamp'` > `'created_at'` > `'createdAt'` > `'ts'` > `'date'`

If no candidate matches, throws `PackagerValidationError('cannot find user/timestamp field; pass userField/timestampField explicitly')`.

Invalid timestamp values (`NaN` after `new Date()` parse) are skipped. If zero valid timestamps remain → `PackagerValidationError`.

---

## 7. `RecurringExporter` title templating

The template string supports two placeholders, expanded at `publish()` time using the computed `claimedMetrics`:

| Placeholder | Replaced with |
|---|---|
| `{start}` | `claimedMetrics.date_range_start` (YYYY-MM-DD) |
| `{end}` | `claimedMetrics.date_range_end` (YYYY-MM-DD) |

Example:

```ts
const exporter = packager.recurring({
  category: 'fitness',
  basePrice: 49.99,
  titleTemplate: 'Workout Sessions — Week of {start}',
});
await exporter.publish(rows);
// → title: "Workout Sessions — Week of 2026-05-04"
```

If the developer wants more sophisticated naming, they call `packager.create()` directly.

---

## 8. Error handling

Single discriminated error type exported from the SDK:

```ts
export class PackagerError extends Error {
  constructor(public code: PackagerErrorCode, message: string, public cause?: unknown);
}
export type PackagerErrorCode =
  | 'AUTH'        // 401 from API or login failure
  | 'VALIDATION'  // local validation failed before any network call
  | 'API'         // non-2xx from /v1/packages (with parsed { message, error })
  | 'NETWORK'     // fetch threw
  ;
```

Errors thrown by helpers (`inferSchema`, etc.) propagate as `VALIDATION`. No retry loop in MVP — caller decides.

---

## 9. Files added / changed

| File | Change |
|---|---|
| `packages/sdk-node/src/packager.ts` | new — `DataClausPackager`, `RecurringExporter`, helpers, errors |
| `packages/sdk-node/src/types.ts` | new (or extend existing) — `ClaimedMetrics`, `PackageStatus`, `DataPackage` types mirroring backend |
| `packages/sdk-node/src/index.ts` | re-export everything from `packager.ts` |
| `packages/sdk-node/README.md` | add a "Data Packages" section with the two examples below |
| `packages/sdk-node/__tests__/packager.test.ts` | new — unit tests for `inferSchema`, `pickSampleRows`, `computeClaimedMetrics`, `RecurringExporter.publish` (mocked fetch) |
| `scripts/demo-sdk-export.ts` | new — end-to-end demo script using a local fixture file `scripts/fixtures/workouts.json` |
| `scripts/fixtures/workouts.json` | new — ~1200 generated workout rows for the demo script |

No changes to `apps/dataclaus-nestjs-api/**` or `apps/dataclaus-web/**`.

Optional polish (not blocking): a small `<SdkQuickStart />` card on `/dashboard/packages` that copies an example `export.ts` snippet — call this out as a follow-up, not Phase 1.

---

## 10. Demo script

```ts
// scripts/demo-sdk-export.ts
import { readFile } from 'node:fs/promises';
import { DataClausPackager } from '../packages/sdk-node/src';

async function main() {
  const packager = await DataClausPackager.login({
    apiUrl: 'http://localhost:3002',
    email: 'developer@fitandmove.io',
    password: 'demo-password',
  });

  const rows = JSON.parse(await readFile('./scripts/fixtures/workouts.json', 'utf8'));

  const exporter = packager.recurring({
    category: 'fitness',
    basePrice: 49.99,
    titleTemplate: 'Workout Data — Week of {start}',
    description: 'Aggregated workout sessions from Fit & Move users.',
    userField: 'user_id',
    timestampField: 'timestamp',
  });

  const result = await exporter.publish(rows);
  console.log(`✓ Package ${result.id} → status: ${result.status}`);
  console.log(`  http://localhost:3000/marketplace/${result.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Run: `pnpm tsx scripts/demo-sdk-export.ts`.

Expected: 201 from API within ~200 ms; LLM eval completes in 3–8 s; the package becomes visible in `/marketplace` once `status` flips to `certified`.

---

## 11. Acceptance criteria (done = all true)

1. `pnpm tsx scripts/demo-sdk-export.ts` reads ~1200 rows from a local fixture, creates a real package via the running NestJS API, and prints a marketplace URL.
2. Submitting the same fixture twice in a row creates two distinct packages — both certifiable, both visible in `/dashboard/packages`.
3. `packager.create({...})` works with all overrides supplied (no inference triggered).
4. `packager.create({...})` works with zero overrides (full auto-inference) on the fixture data.
5. Unit tests cover: type inference for each of the seven mappings in §6.1; sample-row determinism; metrics field-fallback chain; explicit `PackagerValidationError` when min-rows / missing-field hits.
6. README has a "Data Packages" section showing both one-shot and recurring usage.
7. Calling against a stopped API surfaces `PackagerError { code: 'NETWORK' }`, not an unhandled fetch rejection.
8. Web UI form at `/dashboard/packages/new` still works unchanged (regression check).

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Schema inference picks `string` for ambiguous fields, confusing the LLM | Fallback is documented; developer can override via `schemaJson`. |
| Developer's row keys don't match heuristic for user/timestamp field | Explicit `PackagerValidationError` with actionable message; demo script passes them explicitly. |
| `/auth/login` rate-limit during demo retries | `login()` is a one-shot at process start; if it 429s, surface `PackagerError { code: 'AUTH' }` clearly — caller waits or uses direct token. |
| `POST /v1/packages` body too large (1200 rows × big payload) | We only send the 8 sampled rows + schema + metrics — the full dataset never crosses the wire in MVP. The full `rows[]` stays local to the developer process. |
| Cron drift / duplicate publish on the same day | Out of scope for MVP; developer can de-dupe via `titleTemplate` containing `{start}-{end}` and detecting 4xx duplicates if a server-side uniqueness constraint is added later. |

---

## 13. Open questions

None blocking — taiko approved Approach A (selective `create` + `recurring` template) and "easiest path that pulls real data in demo." The remaining choices (sample size = 8, helper exports public, error class shape) are author's call and listed above.
