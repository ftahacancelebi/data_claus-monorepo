# SDK Data-Package Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-11-sdk-package-export-design.md`

**Goal:** Add a `DataClausPackager` class to `@dataclaus/sdk-node` that lets developers create marketplace packages programmatically from their own datasets, with auto-inferred schema / sample / metrics, plus a recurring-template helper for scheduled exports.

**Architecture:** Pure additive SDK feature. Reuses the existing `POST /v1/packages` endpoint and `/auth/login` — zero backend or web changes. The SDK accepts the developer's full `rows[]`, infers schema, picks 8 sample rows, computes `claimed_metrics`, and submits via Bearer JWT.

**Tech Stack:** TypeScript (CommonJS, ES2020 target), Jest + ts-jest for tests, native `globalThis.fetch` (requires Node 18+ — bumped from current >=16), zero new runtime deps.

---

## File Structure

| Path | Responsibility |
|---|---|
| `packages/sdk-node/jest.config.js` | Jest config (ts-jest preset, test paths). |
| `packages/sdk-node/package.json` | Add test scripts, Jest devDeps; bump engines to >=18. |
| `packages/sdk-node/src/types.ts` | Shared types: `ClaimedMetrics`, `PackageStatus`, `DataPackageRef`. |
| `packages/sdk-node/src/packager-helpers.ts` | Pure helpers: `inferSchema`, `pickSampleRows`, `computeClaimedMetrics`. Public-exported. |
| `packages/sdk-node/src/packager-errors.ts` | `PackagerError` class + `PackagerErrorCode` type. |
| `packages/sdk-node/src/packager.ts` | `DataClausPackager` class + `RecurringExporter`. Network + orchestration. |
| `packages/sdk-node/src/index.ts` | Add re-exports for all new public symbols. |
| `packages/sdk-node/__tests__/packager-helpers.test.ts` | Unit tests for the three pure helpers. |
| `packages/sdk-node/__tests__/packager.test.ts` | Unit tests for `create()`, `login()`, `RecurringExporter.publish()`, with mocked `fetch`. |
| `packages/sdk-node/README.md` | New "Data Packages" section with both usage examples. |
| `scripts/fixtures/workouts.json` | ~1200 generated workout rows for the demo. |
| `scripts/demo-sdk-export.ts` | Demo script that logs in, reads fixture, calls `recurring().publish()`. |

Pure logic (`packager-helpers.ts`) and orchestration (`packager.ts`) split so the helpers can be unit-tested with zero mocking. Errors split into their own file so both helpers and packager import from a single source.

---

## Task 1: Test Infrastructure

**Files:**
- Modify: `packages/sdk-node/package.json`
- Create: `packages/sdk-node/jest.config.js`
- Create: `packages/sdk-node/__tests__/.gitkeep`

- [ ] **Step 1.1: Add Jest + ts-jest devDeps and test script**

Run from repo root:
```bash
cd packages/sdk-node && npm install --save-dev jest@29 ts-jest@29 @types/jest@29
```

Expected: `package.json` updated with `jest`, `ts-jest`, `@types/jest` under `devDependencies`. Lockfile updated.

- [ ] **Step 1.2: Add scripts and bump engines in `package.json`**

Edit `packages/sdk-node/package.json`. Inside the `scripts` block, add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

Inside `engines`, change `"node": ">=16.0.0"` to `"node": ">=18.0.0"` (Packager uses native `fetch`).

- [ ] **Step 1.3: Create `jest.config.js`**

Create `packages/sdk-node/jest.config.js`:
```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  // Suppress ts-jest "isolatedModules" hint (warning-only).
  globals: {
    'ts-jest': { isolatedModules: true },
  },
};
```

- [ ] **Step 1.4: Create empty `__tests__/.gitkeep`**

```bash
touch packages/sdk-node/__tests__/.gitkeep
```

- [ ] **Step 1.5: Verify Jest runs (no tests yet)**

```bash
cd packages/sdk-node && npx jest --passWithNoTests
```

Expected output ends with: `No tests found, exiting with code 0` (the `--passWithNoTests` flag makes it exit 0).

- [ ] **Step 1.6: Commit**

```bash
git add packages/sdk-node/package.json packages/sdk-node/package-lock.json packages/sdk-node/jest.config.js packages/sdk-node/__tests__/.gitkeep
git commit -m "chore(sdk-node): add Jest test harness for packager"
```

---

## Task 2: Shared Types

**Files:**
- Create: `packages/sdk-node/src/types.ts`

- [ ] **Step 2.1: Write `src/types.ts`**

```ts
/**
 * Types shared between packager helpers and the Packager class.
 * Mirrors `apps/dataclaus-nestjs-api/src/modules/data-packages/dto/create-package.dto.ts`.
 */

export interface ClaimedMetrics {
  row_count: number;
  unique_users: number;
  /** ISO date string YYYY-MM-DD */
  date_range_start: string;
  /** ISO date string YYYY-MM-DD */
  date_range_end: string;
}

export type PackageStatus =
  | 'pending'
  | 'evaluating'
  | 'certified'
  | 'rejected'
  | 'sold'
  | 'delisted';

export type SchemaJson = Record<string, string>;

export type Row = Record<string, unknown>;
```

- [ ] **Step 2.2: Verify it compiles**

```bash
cd packages/sdk-node && npx tsc --noEmit
```

Expected: no output, exit 0.

- [ ] **Step 2.3: Commit**

```bash
git add packages/sdk-node/src/types.ts
git commit -m "feat(sdk-node): add shared package types"
```

---

## Task 3: `inferSchema` Helper

**Files:**
- Create: `packages/sdk-node/src/packager-helpers.ts`
- Create: `packages/sdk-node/__tests__/packager-helpers.test.ts`

- [ ] **Step 3.1: Write failing tests for `inferSchema`**

Create `packages/sdk-node/__tests__/packager-helpers.test.ts`:
```ts
import { inferSchema } from '../src/packager-helpers';

describe('inferSchema', () => {
  it('infers number type from numeric values', () => {
    const out = inferSchema([{ a: 1 }, { a: 2.5 }]);
    expect(out).toEqual({ a: 'number' });
  });

  it('infers boolean type', () => {
    const out = inferSchema([{ ok: true }, { ok: false }]);
    expect(out).toEqual({ ok: 'boolean' });
  });

  it('infers string type for plain strings', () => {
    const out = inferSchema([{ name: 'alice' }, { name: 'bob' }]);
    expect(out).toEqual({ name: 'string' });
  });

  it('infers timestamp for ISO 8601 strings', () => {
    const out = inferSchema([
      { ts: '2025-05-08T10:00:00Z' },
      { ts: '2025-05-09T11:00:00Z' },
    ]);
    expect(out).toEqual({ ts: 'timestamp' });
  });

  it('infers timestamp for date-only ISO strings', () => {
    const out = inferSchema([{ d: '2025-05-08' }, { d: '2025-05-09' }]);
    expect(out).toEqual({ d: 'timestamp' });
  });

  it('infers json for arrays', () => {
    const out = inferSchema([{ tags: ['a', 'b'] }, { tags: ['c'] }]);
    expect(out).toEqual({ tags: 'json' });
  });

  it('infers json for nested objects', () => {
    const out = inferSchema([{ meta: { k: 1 } }, { meta: { k: 2 } }]);
    expect(out).toEqual({ meta: 'json' });
  });

  it('falls back to string on mixed types', () => {
    const out = inferSchema([{ x: 1 }, { x: 'hello' }]);
    expect(out).toEqual({ x: 'string' });
  });

  it('skips null and undefined', () => {
    const out = inferSchema([{ a: null, b: 1 }, { a: undefined, b: 2 }]);
    expect(out).toEqual({ b: 'number' });
  });

  it('omits fields that are always null', () => {
    const out = inferSchema([{ a: null }, { a: null }]);
    expect(out).toEqual({});
  });

  it('considers only the first 100 rows', () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ a: i }));
    rows[150] = { a: 'string-at-150' as unknown as number };
    const out = inferSchema(rows);
    expect(out).toEqual({ a: 'number' });
  });
});
```

- [ ] **Step 3.2: Run, verify failure**

```bash
cd packages/sdk-node && npx jest packager-helpers.test
```

Expected: FAIL with `Cannot find module '../src/packager-helpers'`.

- [ ] **Step 3.3: Implement `inferSchema` in `src/packager-helpers.ts`**

```ts
import type { Row, SchemaJson } from './types';

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

type InferredType = 'string' | 'number' | 'boolean' | 'timestamp' | 'json';

function typeOfValue(value: unknown): InferredType | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (Array.isArray(value)) return 'json';
  if (typeof value === 'object') return 'json';
  if (typeof value === 'string') {
    return ISO_DATETIME.test(value) ? 'timestamp' : 'string';
  }
  return 'string';
}

/**
 * Walks up to the first 100 rows, gathers the set of observed types per
 * field, reduces each to a single type string. Mixed types collapse to
 * 'string' (lossy fallback). Fields that are always null/undefined are
 * omitted from the returned schema.
 */
export function inferSchema(rows: Row[]): SchemaJson {
  const observed: Record<string, Set<InferredType>> = {};
  const sample = rows.slice(0, 100);
  for (const row of sample) {
    for (const [key, value] of Object.entries(row)) {
      const t = typeOfValue(value);
      if (t === null) continue;
      if (!observed[key]) observed[key] = new Set();
      observed[key].add(t);
    }
  }
  const out: SchemaJson = {};
  for (const [key, set] of Object.entries(observed)) {
    out[key] = set.size === 1 ? [...set][0] : 'string';
  }
  return out;
}
```

- [ ] **Step 3.4: Run tests, verify all pass**

```bash
cd packages/sdk-node && npx jest packager-helpers.test
```

Expected: 11 passing tests.

- [ ] **Step 3.5: Commit**

```bash
git add packages/sdk-node/src/packager-helpers.ts packages/sdk-node/__tests__/packager-helpers.test.ts
git commit -m "feat(sdk-node): infer package schema from row samples"
```

---

## Task 4: `pickSampleRows` Helper

**Files:**
- Modify: `packages/sdk-node/src/packager-helpers.ts`
- Modify: `packages/sdk-node/__tests__/packager-helpers.test.ts`
- Create: `packages/sdk-node/src/packager-errors.ts`

- [ ] **Step 4.1: Create `PackagerError` class**

Create `packages/sdk-node/src/packager-errors.ts`:
```ts
export type PackagerErrorCode = 'AUTH' | 'VALIDATION' | 'API' | 'NETWORK';

export class PackagerError extends Error {
  public readonly code: PackagerErrorCode;
  public readonly cause?: unknown;

  constructor(code: PackagerErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'PackagerError';
    this.code = code;
    this.cause = cause;
    // Restore prototype chain for `instanceof` across ES5 targets.
    Object.setPrototypeOf(this, PackagerError.prototype);
  }
}
```

- [ ] **Step 4.2: Add failing tests for `pickSampleRows`**

Append to `packages/sdk-node/__tests__/packager-helpers.test.ts`:
```ts
import { pickSampleRows } from '../src/packager-helpers';
import { PackagerError } from '../src/packager-errors';

describe('pickSampleRows', () => {
  it('throws PackagerError VALIDATION when fewer than 5 rows', () => {
    expect(() => pickSampleRows([{ a: 1 }, { a: 2 }])).toThrow(PackagerError);
    try {
      pickSampleRows([{ a: 1 }]);
    } catch (err) {
      expect((err as PackagerError).code).toBe('VALIDATION');
    }
  });

  it('returns all rows when length is between 5 and n', () => {
    const rows = [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }, { a: 6 }];
    const out = pickSampleRows(rows, 8);
    expect(out).toHaveLength(6);
  });

  it('returns exactly n rows when input is larger', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ i }));
    const out = pickSampleRows(rows, 8);
    expect(out).toHaveLength(8);
  });

  it('returns deterministic samples for the same input', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ i }));
    const a = pickSampleRows(rows, 8);
    const b = pickSampleRows(rows, 8);
    expect(a).toEqual(b);
  });

  it('strips undefined values from rows', () => {
    const rows = [
      { a: 1, b: undefined },
      { a: 2, b: undefined },
      { a: 3, b: 4 },
      { a: 5, b: undefined },
      { a: 6, b: undefined },
    ];
    const out = pickSampleRows(rows, 8);
    for (const row of out) {
      expect(Object.prototype.hasOwnProperty.call(row, 'b') ? row.b : 'missing').not.toBe(undefined);
    }
  });
});
```

- [ ] **Step 4.3: Run, verify failure**

```bash
cd packages/sdk-node && npx jest packager-helpers.test
```

Expected: 5 failing tests with `pickSampleRows is not a function` (or similar).

- [ ] **Step 4.4: Implement `pickSampleRows`**

Append to `packages/sdk-node/src/packager-helpers.ts`:
```ts
import { PackagerError } from './packager-errors';

/**
 * Deterministic Mulberry32 PRNG for reproducible sample picks across runs.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stripUndefined(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Pick a sample of rows for the marketplace API.
 *   - rows.length < 5 → PackagerError('VALIDATION')
 *   - rows.length in [5, n) → returns all rows (no up-sampling)
 *   - rows.length >= n → seeded random pick of n rows
 *   - undefined values stripped from returned rows (JSON safety)
 */
export function pickSampleRows(rows: Row[], n = 8): Row[] {
  if (rows.length < 5) {
    throw new PackagerError(
      'VALIDATION',
      `need at least 5 rows; got ${rows.length} (API minimum)`,
    );
  }
  if (rows.length <= n) return rows.map(stripUndefined);

  const rand = mulberry32(rows.length);
  const indexes = new Set<number>();
  while (indexes.size < n) {
    indexes.add(Math.floor(rand() * rows.length));
  }
  return [...indexes].sort((a, b) => a - b).map((i) => stripUndefined(rows[i]));
}
```

- [ ] **Step 4.5: Run, verify pass**

```bash
cd packages/sdk-node && npx jest packager-helpers.test
```

Expected: 16 passing tests (11 from Task 3 + 5 new).

- [ ] **Step 4.6: Commit**

```bash
git add packages/sdk-node/src/packager-errors.ts packages/sdk-node/src/packager-helpers.ts packages/sdk-node/__tests__/packager-helpers.test.ts
git commit -m "feat(sdk-node): seeded sample-row picker + PackagerError"
```

---

## Task 5: `computeClaimedMetrics` Helper

**Files:**
- Modify: `packages/sdk-node/src/packager-helpers.ts`
- Modify: `packages/sdk-node/__tests__/packager-helpers.test.ts`

- [ ] **Step 5.1: Append failing tests**

Append to `packages/sdk-node/__tests__/packager-helpers.test.ts`:
```ts
import { computeClaimedMetrics } from '../src/packager-helpers';

describe('computeClaimedMetrics', () => {
  const rows = [
    { user_id: 'u1', timestamp: '2025-05-01T10:00:00Z' },
    { user_id: 'u2', timestamp: '2025-05-03T11:00:00Z' },
    { user_id: 'u1', timestamp: '2025-05-05T12:00:00Z' },
    { user_id: 'u3', timestamp: '2025-05-08T13:00:00Z' },
  ];

  it('computes row_count and unique_users', () => {
    const out = computeClaimedMetrics(rows);
    expect(out.row_count).toBe(4);
    expect(out.unique_users).toBe(3);
  });

  it('computes ISO date range from timestamp field', () => {
    const out = computeClaimedMetrics(rows);
    expect(out.date_range_start).toBe('2025-05-01');
    expect(out.date_range_end).toBe('2025-05-08');
  });

  it('falls back through user-field aliases (userId)', () => {
    const out = computeClaimedMetrics([
      { userId: 'a', timestamp: '2025-05-01' },
      { userId: 'b', timestamp: '2025-05-02' },
      { userId: 'a', timestamp: '2025-05-03' },
    ]);
    expect(out.unique_users).toBe(2);
  });

  it('falls back through timestamp-field aliases (created_at)', () => {
    const out = computeClaimedMetrics([
      { user_id: 'a', created_at: '2025-05-01' },
      { user_id: 'b', created_at: '2025-05-02' },
    ]);
    expect(out.date_range_start).toBe('2025-05-01');
    expect(out.date_range_end).toBe('2025-05-02');
  });

  it('uses explicit options over heuristics', () => {
    const out = computeClaimedMetrics(
      [
        { account: 'a', ts: '2025-05-01' },
        { account: 'b', ts: '2025-05-02' },
      ],
      { userField: 'account', timestampField: 'ts' },
    );
    expect(out.unique_users).toBe(2);
    expect(out.date_range_start).toBe('2025-05-01');
  });

  it('throws PackagerError VALIDATION when no user field is found', () => {
    expect(() =>
      computeClaimedMetrics([
        { something: 'x', timestamp: '2025-05-01' },
        { something: 'y', timestamp: '2025-05-02' },
      ]),
    ).toThrow(PackagerError);
  });

  it('throws PackagerError VALIDATION when no timestamp field is found', () => {
    expect(() =>
      computeClaimedMetrics([
        { user_id: 'a', payload: {} },
        { user_id: 'b', payload: {} },
      ]),
    ).toThrow(PackagerError);
  });

  it('skips rows whose timestamp does not parse', () => {
    const out = computeClaimedMetrics([
      { user_id: 'a', timestamp: 'not-a-date' },
      { user_id: 'b', timestamp: '2025-05-02' },
      { user_id: 'c', timestamp: '2025-05-04' },
    ]);
    expect(out.date_range_start).toBe('2025-05-02');
    expect(out.date_range_end).toBe('2025-05-04');
  });

  it('throws PackagerError VALIDATION when all timestamps are invalid', () => {
    expect(() =>
      computeClaimedMetrics([
        { user_id: 'a', timestamp: 'nope' },
        { user_id: 'b', timestamp: 'nope' },
      ]),
    ).toThrow(PackagerError);
  });
});
```

- [ ] **Step 5.2: Run, verify failure**

```bash
cd packages/sdk-node && npx jest packager-helpers.test
```

Expected: 9 failing tests for the new `describe` block.

- [ ] **Step 5.3: Implement `computeClaimedMetrics`**

Append to `packages/sdk-node/src/packager-helpers.ts`:
```ts
import type { ClaimedMetrics } from './types';

const USER_FIELD_FALLBACKS = ['user_id', 'userId', 'external_user_id', 'externalUserId'] as const;
const TIMESTAMP_FIELD_FALLBACKS = ['timestamp', 'created_at', 'createdAt', 'ts', 'date'] as const;

function findField(rows: Row[], candidates: readonly string[]): string | undefined {
  for (const cand of candidates) {
    if (rows.some((r) => r[cand] !== undefined && r[cand] !== null)) return cand;
  }
  return undefined;
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function computeClaimedMetrics(
  rows: Row[],
  opts: { userField?: string; timestampField?: string } = {},
): ClaimedMetrics {
  const userField = opts.userField ?? findField(rows, USER_FIELD_FALLBACKS);
  if (!userField) {
    throw new PackagerError(
      'VALIDATION',
      `cannot find user field; tried [${USER_FIELD_FALLBACKS.join(', ')}]. Pass userField explicitly.`,
    );
  }
  const tsField = opts.timestampField ?? findField(rows, TIMESTAMP_FIELD_FALLBACKS);
  if (!tsField) {
    throw new PackagerError(
      'VALIDATION',
      `cannot find timestamp field; tried [${TIMESTAMP_FIELD_FALLBACKS.join(', ')}]. Pass timestampField explicitly.`,
    );
  }

  const users = new Set<string>();
  const dates: string[] = [];
  for (const row of rows) {
    const u = row[userField];
    if (u !== undefined && u !== null) users.add(String(u));
    const iso = toIsoDate(row[tsField]);
    if (iso) dates.push(iso);
  }

  if (dates.length === 0) {
    throw new PackagerError(
      'VALIDATION',
      `field "${tsField}" had no parseable timestamps across ${rows.length} rows`,
    );
  }

  dates.sort();
  return {
    row_count: rows.length,
    unique_users: users.size,
    date_range_start: dates[0],
    date_range_end: dates[dates.length - 1],
  };
}
```

- [ ] **Step 5.4: Run, verify all pass**

```bash
cd packages/sdk-node && npx jest packager-helpers.test
```

Expected: 25 passing tests total (16 prior + 9 new).

- [ ] **Step 5.5: Commit**

```bash
git add packages/sdk-node/src/packager-helpers.ts packages/sdk-node/__tests__/packager-helpers.test.ts
git commit -m "feat(sdk-node): compute claimed_metrics from rows with field heuristics"
```

---

## Task 6: `DataClausPackager.create()`

**Files:**
- Create: `packages/sdk-node/src/packager.ts`
- Create: `packages/sdk-node/__tests__/packager.test.ts`

- [ ] **Step 6.1: Write failing test for `create()` with full overrides**

Create `packages/sdk-node/__tests__/packager.test.ts`:
```ts
import { DataClausPackager } from '../src/packager';
import { PackagerError } from '../src/packager-errors';

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function mockFetchOnce(response: { ok: boolean; status: number; body: unknown }) {
  const fetchMock = jest.fn(async (_input: FetchInput, _init?: FetchInit) => ({
    ok: response.ok,
    status: response.status,
    statusText: response.ok ? 'OK' : 'Error',
    json: async () => response.body,
  })) as unknown as typeof fetch;
  (globalThis as { fetch: typeof fetch }).fetch = fetchMock;
  return fetchMock as unknown as jest.Mock;
}

describe('DataClausPackager.create — overrides supplied', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('POSTs with the exact body when all fields are supplied', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 201,
      body: { data: { id: 'pkg_abc', status: 'evaluating' } },
    });

    const packager = new DataClausPackager({
      apiUrl: 'http://api.test',
      authToken: 'jwt-token',
    });

    const rows = Array.from({ length: 10 }, (_, i) => ({
      user_id: `u${i}`,
      timestamp: `2025-05-0${(i % 9) + 1}`,
      value: i,
    }));

    const result = await packager.create({
      title: 'Test Package',
      category: 'fitness',
      description: 'desc',
      rows,
      price: 49.99,
      schemaJson: { user_id: 'string', timestamp: 'timestamp', value: 'number' },
      claimedMetrics: {
        row_count: 10,
        unique_users: 10,
        date_range_start: '2025-05-01',
        date_range_end: '2025-05-09',
      },
    });

    expect(result).toEqual({ id: 'pkg_abc', status: 'evaluating' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/v1/packages');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token');
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe('Test Package');
    expect(body.category).toBe('fitness');
    expect(body.price).toBe(49.99);
    expect(body.schema_json).toEqual({
      user_id: 'string',
      timestamp: 'timestamp',
      value: 'number',
    });
    expect(body.sample_rows).toHaveLength(8);
    expect(body.claimed_metrics.row_count).toBe(10);
  });
});
```

- [ ] **Step 6.2: Run, verify failure**

```bash
cd packages/sdk-node && npx jest packager.test
```

Expected: FAIL with `Cannot find module '../src/packager'`.

- [ ] **Step 6.3: Implement minimal `DataClausPackager.create()` to make that test pass**

Create `packages/sdk-node/src/packager.ts`:
```ts
import {
  inferSchema,
  pickSampleRows,
  computeClaimedMetrics,
} from './packager-helpers';
import { PackagerError } from './packager-errors';
import type { ClaimedMetrics, PackageStatus, Row, SchemaJson } from './types';

export interface PackagerConfig {
  apiUrl: string;
  authToken: string;
}

export interface CreatePackageInput {
  title: string;
  category: string;
  description?: string;
  rows: Row[];
  price: number;
  applicationId?: string;
  userField?: string;
  timestampField?: string;
  schemaJson?: SchemaJson;
  claimedMetrics?: ClaimedMetrics;
}

export interface CreatePackageResult {
  id: string;
  status: PackageStatus;
}

interface ApiSuccess<T> {
  data: T;
  statusCode?: number;
  message?: string;
}

interface ApiError {
  message?: string;
  error?: string;
}

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as ApiSuccess<T>).data;
  }
  return body as T;
}

export class DataClausPackager {
  protected readonly apiUrl: string;
  protected readonly authToken: string;

  constructor(config: PackagerConfig) {
    if (!config.apiUrl) {
      throw new PackagerError('VALIDATION', 'PackagerConfig.apiUrl is required');
    }
    if (!config.authToken) {
      throw new PackagerError('VALIDATION', 'PackagerConfig.authToken is required');
    }
    this.apiUrl = config.apiUrl.replace(/\/+$/, '');
    this.authToken = config.authToken;
  }

  async create(input: CreatePackageInput): Promise<CreatePackageResult> {
    if (!Array.isArray(input.rows) || input.rows.length === 0) {
      throw new PackagerError('VALIDATION', 'rows must be a non-empty array');
    }

    const sample_rows = pickSampleRows(input.rows, 8);
    const schema_json = input.schemaJson ?? inferSchema(input.rows);
    const claimed_metrics =
      input.claimedMetrics ??
      computeClaimedMetrics(input.rows, {
        userField: input.userField,
        timestampField: input.timestampField,
      });

    const body = {
      title: input.title,
      description: input.description,
      category: input.category,
      claimed_metrics,
      schema_json,
      sample_rows,
      price: input.price,
      application_id: input.applicationId,
    };

    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/v1/packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new PackagerError('NETWORK', `network error: ${(err as Error).message}`, err);
    }

    const json = (await response.json().catch(() => null)) as unknown;

    if (response.status === 401 || response.status === 403) {
      throw new PackagerError(
        'AUTH',
        `unauthorized: ${(json as ApiError)?.message ?? response.statusText}`,
      );
    }
    if (!response.ok) {
      throw new PackagerError(
        'API',
        `package create failed (${response.status}): ${
          (json as ApiError)?.message ?? response.statusText
        }`,
      );
    }

    const data = unwrap<CreatePackageResult>(json);
    return { id: data.id, status: data.status };
  }
}
```

- [ ] **Step 6.4: Run, verify pass**

```bash
cd packages/sdk-node && npx jest packager.test
```

Expected: 1 passing test.

- [ ] **Step 6.5: Add test for auto-inference path**

Append to `packages/sdk-node/__tests__/packager.test.ts`:
```ts
describe('DataClausPackager.create — auto inference', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('auto-fills schema_json, sample_rows, claimed_metrics from rows', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 201,
      body: { data: { id: 'pkg_xyz', status: 'evaluating' } },
    });

    const packager = new DataClausPackager({
      apiUrl: 'http://api.test',
      authToken: 't',
    });

    const rows = Array.from({ length: 12 }, (_, i) => ({
      user_id: `u${i % 3}`,
      timestamp: `2025-05-${String((i % 28) + 1).padStart(2, '0')}`,
      kind: 'workout',
      minutes: 30 + i,
    }));

    await packager.create({
      title: 'Auto Test',
      category: 'fitness',
      rows,
      price: 19.99,
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.schema_json).toEqual({
      user_id: 'string',
      timestamp: 'timestamp',
      kind: 'string',
      minutes: 'number',
    });
    expect(body.sample_rows).toHaveLength(8);
    expect(body.claimed_metrics.row_count).toBe(12);
    expect(body.claimed_metrics.unique_users).toBe(3);
  });
});
```

- [ ] **Step 6.6: Add tests for error paths**

Append to `packages/sdk-node/__tests__/packager.test.ts`:
```ts
describe('DataClausPackager.create — error paths', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('throws AUTH on 401', async () => {
    mockFetchOnce({ ok: false, status: 401, body: { message: 'no token' } });
    const packager = new DataClausPackager({ apiUrl: 'http://api.test', authToken: 't' });
    const rows = Array.from({ length: 8 }, (_, i) => ({
      user_id: `u${i}`,
      timestamp: '2025-05-01',
    }));
    await expect(
      packager.create({ title: 't', category: 'c', rows, price: 1 }),
    ).rejects.toMatchObject({ code: 'AUTH' });
  });

  it('throws API on 4xx with parsed message', async () => {
    mockFetchOnce({
      ok: false,
      status: 400,
      body: { message: 'title too short' },
    });
    const packager = new DataClausPackager({ apiUrl: 'http://api.test', authToken: 't' });
    const rows = Array.from({ length: 8 }, (_, i) => ({
      user_id: `u${i}`,
      timestamp: '2025-05-01',
    }));
    await expect(
      packager.create({ title: 't', category: 'c', rows, price: 1 }),
    ).rejects.toMatchObject({ code: 'API', message: expect.stringContaining('title too short') });
  });

  it('throws NETWORK when fetch rejects', async () => {
    (globalThis as { fetch: typeof fetch }).fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const packager = new DataClausPackager({ apiUrl: 'http://api.test', authToken: 't' });
    const rows = Array.from({ length: 8 }, (_, i) => ({
      user_id: `u${i}`,
      timestamp: '2025-05-01',
    }));
    await expect(
      packager.create({ title: 't', category: 'c', rows, price: 1 }),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });
});
```

- [ ] **Step 6.7: Run, verify all pass**

```bash
cd packages/sdk-node && npx jest packager.test
```

Expected: 5 passing tests.

- [ ] **Step 6.8: Commit**

```bash
git add packages/sdk-node/src/packager.ts packages/sdk-node/__tests__/packager.test.ts
git commit -m "feat(sdk-node): DataClausPackager.create with auto-inference"
```

---

## Task 7: `DataClausPackager.login()`

**Files:**
- Modify: `packages/sdk-node/src/packager.ts`
- Modify: `packages/sdk-node/__tests__/packager.test.ts`

- [ ] **Step 7.1: Write failing test for `login()`**

Append to `packages/sdk-node/__tests__/packager.test.ts`:
```ts
describe('DataClausPackager.login', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('exchanges email/password for a JWT and returns a usable Packager', async () => {
    const fetchMock = jest.fn(async (input: FetchInput, init?: FetchInit) => {
      const url = String(input);
      if (url.endsWith('/auth/login')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            data: { accessToken: 'minted-jwt', user: { id: 'u1', role: 'developer' } },
          }),
        };
      }
      // Second call: POST /v1/packages with the new token
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer minted-jwt');
      return {
        ok: true,
        status: 201,
        statusText: 'Created',
        json: async () => ({ data: { id: 'pkg_1', status: 'evaluating' } }),
      };
    }) as unknown as typeof fetch;
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock;

    const packager = await DataClausPackager.login({
      apiUrl: 'http://api.test',
      email: 'dev@example.com',
      password: 'secret',
    });

    const rows = Array.from({ length: 8 }, (_, i) => ({
      user_id: `u${i}`,
      timestamp: '2025-05-01',
    }));
    const res = await packager.create({ title: 't', category: 'fitness', rows, price: 9.99 });
    expect(res.id).toBe('pkg_1');
  });

  it('throws AUTH when login returns non-2xx', async () => {
    mockFetchOnce({ ok: false, status: 401, body: { message: 'invalid creds' } });
    await expect(
      DataClausPackager.login({
        apiUrl: 'http://api.test',
        email: 'x@y.z',
        password: 'wrong',
      }),
    ).rejects.toMatchObject({ code: 'AUTH' });
  });
});
```

- [ ] **Step 7.2: Run, verify failure**

```bash
cd packages/sdk-node && npx jest packager.test
```

Expected: 2 failing tests (`DataClausPackager.login is not a function`).

- [ ] **Step 7.3: Implement `login()` on `DataClausPackager`**

Append inside the `DataClausPackager` class in `packages/sdk-node/src/packager.ts`, after the `create` method:
```ts
  static async login(opts: {
    apiUrl: string;
    email: string;
    password: string;
  }): Promise<DataClausPackager> {
    const base = opts.apiUrl.replace(/\/+$/, '');
    let response: Response;
    try {
      response = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: opts.email, password: opts.password }),
      });
    } catch (err) {
      throw new PackagerError('NETWORK', `network error during login: ${(err as Error).message}`, err);
    }
    const json = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      throw new PackagerError(
        'AUTH',
        `login failed (${response.status}): ${(json as ApiError)?.message ?? response.statusText}`,
      );
    }
    const data = unwrap<{ accessToken: string }>(json);
    if (!data?.accessToken) {
      throw new PackagerError('AUTH', 'login response did not contain accessToken');
    }
    return new DataClausPackager({ apiUrl: base, authToken: data.accessToken });
  }
```

- [ ] **Step 7.4: Run, verify pass**

```bash
cd packages/sdk-node && npx jest packager.test
```

Expected: 7 passing tests (5 prior + 2 new).

- [ ] **Step 7.5: Commit**

```bash
git add packages/sdk-node/src/packager.ts packages/sdk-node/__tests__/packager.test.ts
git commit -m "feat(sdk-node): static DataClausPackager.login for demo workflows"
```

---

## Task 8: `RecurringExporter`

**Files:**
- Modify: `packages/sdk-node/src/packager.ts`
- Modify: `packages/sdk-node/__tests__/packager.test.ts`

- [ ] **Step 8.1: Write failing tests for recurring template**

Append to `packages/sdk-node/__tests__/packager.test.ts`:
```ts
describe('RecurringExporter', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('expands {start} and {end} placeholders in the title', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 201,
      body: { data: { id: 'pkg_rec', status: 'evaluating' } },
    });
    const packager = new DataClausPackager({ apiUrl: 'http://api.test', authToken: 't' });
    const exporter = packager.recurring({
      category: 'fitness',
      basePrice: 49.99,
      titleTemplate: 'Workouts — Week of {start} to {end}',
    });
    const rows = [
      { user_id: 'a', timestamp: '2025-05-01' },
      { user_id: 'b', timestamp: '2025-05-03' },
      { user_id: 'c', timestamp: '2025-05-05' },
      { user_id: 'a', timestamp: '2025-05-07' },
      { user_id: 'd', timestamp: '2025-05-08' },
    ];
    await exporter.publish(rows);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe('Workouts — Week of 2025-05-01 to 2025-05-08');
    expect(body.price).toBe(49.99);
    expect(body.category).toBe('fitness');
  });

  it('passes optional description and applicationId through', async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      status: 201,
      body: { data: { id: 'pkg_rec2', status: 'evaluating' } },
    });
    const packager = new DataClausPackager({ apiUrl: 'http://api.test', authToken: 't' });
    const exporter = packager.recurring({
      category: 'fitness',
      basePrice: 19,
      titleTemplate: 'Static title',
      description: 'A description',
      applicationId: 'app_123',
      userField: 'account',
      timestampField: 'ts',
    });
    const rows = [
      { account: 'a', ts: '2025-05-01' },
      { account: 'b', ts: '2025-05-02' },
      { account: 'a', ts: '2025-05-03' },
      { account: 'c', ts: '2025-05-04' },
      { account: 'd', ts: '2025-05-05' },
    ];
    await exporter.publish(rows);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.description).toBe('A description');
    expect(body.application_id).toBe('app_123');
    expect(body.claimed_metrics.unique_users).toBe(4);
  });
});
```

- [ ] **Step 8.2: Run, verify failure**

```bash
cd packages/sdk-node && npx jest packager.test
```

Expected: 2 failing tests (`packager.recurring is not a function`).

- [ ] **Step 8.3: Implement `recurring()` and `RecurringExporter`**

Append to `packages/sdk-node/src/packager.ts` (after the `DataClausPackager` class):
```ts
export interface RecurringTemplate {
  category: string;
  basePrice: number;
  titleTemplate: string;
  description?: string;
  applicationId?: string;
  userField?: string;
  timestampField?: string;
}

export class RecurringExporter {
  constructor(
    private readonly packager: DataClausPackager,
    private readonly template: RecurringTemplate,
  ) {}

  async publish(rows: Row[]): Promise<CreatePackageResult> {
    // Compute metrics first so we can plug date_range into the title template.
    const claimedMetrics = computeClaimedMetrics(rows, {
      userField: this.template.userField,
      timestampField: this.template.timestampField,
    });
    const title = this.template.titleTemplate
      .replace('{start}', claimedMetrics.date_range_start)
      .replace('{end}', claimedMetrics.date_range_end);

    return this.packager.create({
      title,
      category: this.template.category,
      description: this.template.description,
      rows,
      price: this.template.basePrice,
      applicationId: this.template.applicationId,
      userField: this.template.userField,
      timestampField: this.template.timestampField,
      // Skip schema/metrics overrides — `create()` will infer / compute.
      claimedMetrics,
    });
  }
}
```

Then add the `recurring()` method inside the `DataClausPackager` class, after `create()`:
```ts
  recurring(template: RecurringTemplate): RecurringExporter {
    if (!template.titleTemplate) {
      throw new PackagerError('VALIDATION', 'titleTemplate is required');
    }
    return new RecurringExporter(this, template);
  }
```

Also at the top of `packager.ts`, the existing import line should already include `computeClaimedMetrics` from Task 6 — no change needed.

- [ ] **Step 8.4: Run, verify pass**

```bash
cd packages/sdk-node && npx jest packager.test
```

Expected: 9 passing tests (7 prior + 2 new).

- [ ] **Step 8.5: Commit**

```bash
git add packages/sdk-node/src/packager.ts packages/sdk-node/__tests__/packager.test.ts
git commit -m "feat(sdk-node): RecurringExporter for scheduled package publishes"
```

---

## Task 9: Wire up `index.ts` exports

**Files:**
- Modify: `packages/sdk-node/src/index.ts`

- [ ] **Step 9.1: Add export block to `src/index.ts`**

Append to `packages/sdk-node/src/index.ts` (before the `// Default export` line at the end, or anywhere appropriate among the other export blocks):
```ts
// Data Packages
export {
  DataClausPackager,
  RecurringExporter,
  type PackagerConfig,
  type CreatePackageInput,
  type CreatePackageResult,
  type RecurringTemplate,
} from './packager';

export {
  inferSchema,
  pickSampleRows,
  computeClaimedMetrics,
} from './packager-helpers';

export {
  PackagerError,
  type PackagerErrorCode,
} from './packager-errors';

export type {
  ClaimedMetrics,
  PackageStatus,
  SchemaJson,
  Row,
} from './types';
```

- [ ] **Step 9.2: Run full test suite + tsc to confirm cohesion**

```bash
cd packages/sdk-node && npx jest && npx tsc --noEmit
```

Expected: all 25 helper tests + 9 packager tests pass; tsc emits nothing.

- [ ] **Step 9.3: Commit**

```bash
git add packages/sdk-node/src/index.ts
git commit -m "feat(sdk-node): re-export packager symbols from package root"
```

---

## Task 10: README "Data Packages" section

**Files:**
- Modify: `packages/sdk-node/README.md`

- [ ] **Step 10.1: Append a new section to the README**

Open `packages/sdk-node/README.md`. After the existing "Get Revenue Summary" section (around the end of the "Quick Start" block), insert a new top-level section:

```markdown
## Data Packages (Marketplace)

Sell behavioral data your app collected. The SDK turns a `rows[]` array
(from your own database) into a marketplace package, auto-filling the
schema, sample rows, and claimed metrics that the DataClaus AI evaluator
needs.

### One-shot (selective) usage

```typescript
import { DataClausPackager } from '@dataclaus/sdk-node';

const packager = new DataClausPackager({
  apiUrl: process.env.DATACLAUS_API_URL ?? 'http://localhost:3000',
  authToken: process.env.DATACLAUS_JWT!,
});

// 1. You select the rows + fields with your own SQL.
const rows = await db.query(`
  SELECT user_id, workout_type, duration_min, calories, timestamp
  FROM workouts
  WHERE timestamp >= NOW() - INTERVAL '7 days'
`);

// 2. SDK handles the rest.
const result = await packager.create({
  title: 'Premium Workout Data — Week of May 5',
  category: 'fitness',
  description: 'High-quality session data from active iOS users.',
  rows,
  price: 49.99,
});

console.log(result); // { id: 'pkg_...', status: 'evaluating' }
```

`schema_json`, the 8-row sample, and `claimed_metrics` are inferred from
`rows`. Pass `schemaJson`, `claimedMetrics`, `userField`, or
`timestampField` to override the defaults.

### Recurring (auto-export) usage

```typescript
const exporter = packager.recurring({
  category: 'fitness',
  basePrice: 49.99,
  titleTemplate: 'Workout Data — Week of {start}',
  description: 'Auto-published weekly batch.',
});

// In your weekly cron:
const rows = await db.query(/* last 7 days */);
await exporter.publish(rows);
// → "Workout Data — Week of 2026-05-04" auto-named from rows.
```

### Demo-friendly login

For demo scripts where the JWT isn't pre-provisioned:

```typescript
const packager = await DataClausPackager.login({
  apiUrl: 'http://localhost:3000',
  email: 'developer@fitandmove.io',
  password: process.env.DATACLAUS_PASSWORD!,
});
```

### Error handling

All packager errors throw a typed `PackagerError`:

```typescript
import { PackagerError } from '@dataclaus/sdk-node';

try {
  await packager.create({ /* ... */ });
} catch (err) {
  if (err instanceof PackagerError) {
    switch (err.code) {
      case 'AUTH':       // 401 or login failure
      case 'VALIDATION': // rows < 5, missing user/timestamp field, etc.
      case 'API':        // 4xx/5xx from the API
      case 'NETWORK':    // fetch threw (server down, DNS, etc.)
    }
  }
  throw err;
}
```
```

- [ ] **Step 10.2: Commit**

```bash
git add packages/sdk-node/README.md
git commit -m "docs(sdk-node): document Data Packages API in README"
```

---

## Task 11: Demo fixture + script

**Files:**
- Create: `scripts/fixtures/workouts.json`
- Create: `scripts/generate-workout-fixture.ts`
- Create: `scripts/demo-sdk-export.ts`

- [ ] **Step 11.1: Create the fixture generator**

Create `scripts/generate-workout-fixture.ts`:
```ts
/**
 * Generates a deterministic ~1200-row workout fixture for the SDK demo.
 * Run once and commit the JSON. Re-run to regenerate.
 *
 *   pnpm exec ts-node --transpile-only --project scripts/tsconfig.json scripts/generate-workout-fixture.ts
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface WorkoutRow {
  user_id: string;
  workout_type: 'run' | 'lift' | 'yoga' | 'swim' | 'cycle';
  duration_min: number;
  calories: number;
  timestamp: string;
}

const TYPES: WorkoutRow['workout_type'][] = ['run', 'lift', 'yoga', 'swim', 'cycle'];

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seeded(20260511);

const rows: WorkoutRow[] = [];
const startDate = new Date('2026-04-15T00:00:00Z').getTime();
const dayMs = 24 * 60 * 60 * 1000;

for (let i = 0; i < 1247; i++) {
  const dayOffset = Math.floor(rand() * 28); // last ~4 weeks
  const timestamp = new Date(startDate + dayOffset * dayMs + Math.floor(rand() * dayMs)).toISOString();
  const userId = `u_${Math.floor(rand() * 312).toString(36)}`;
  const type = TYPES[Math.floor(rand() * TYPES.length)];
  const duration_min = Math.floor(15 + rand() * 75);
  rows.push({
    user_id: userId,
    workout_type: type,
    duration_min,
    calories: Math.floor(duration_min * (4 + rand() * 6)),
    timestamp,
  });
}

const outPath = resolve(__dirname, 'fixtures', 'workouts.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(rows, null, 2));
console.log(`wrote ${rows.length} rows → ${outPath}`);
```

- [ ] **Step 11.2: Run the generator to create the fixture**

```bash
cd /Users/tahacancelebi/Desktop/data_claus-monorepo && pnpm exec ts-node --transpile-only --project scripts/tsconfig.json scripts/generate-workout-fixture.ts
```

Expected output: `wrote 1247 rows → /.../scripts/fixtures/workouts.json`. A new file `scripts/fixtures/workouts.json` should exist.

- [ ] **Step 11.3: Create the demo script**

Create `scripts/demo-sdk-export.ts`:
```ts
/**
 * Demo: log in as the seeded developer, read the workout fixture, and
 * publish a real package to the running NestJS API via @dataclaus/sdk-node.
 *
 *   pnpm exec ts-node --transpile-only --project scripts/tsconfig.json scripts/demo-sdk-export.ts
 *
 * Prerequisites:
 *   - NestJS API running:   pnpm run dev:api   (defaults to :3000)
 *   - Demo seed has run:    pnpm run demo:seed
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataClausPackager } from '../packages/sdk-node/src';

const API_URL = process.env.DATACLAUS_API_URL ?? 'http://localhost:3000';
const EMAIL = process.env.DATACLAUS_DEMO_EMAIL ?? 'developer.fitness@dataclaus.demo';
const PASSWORD = process.env.DATACLAUS_DEMO_PASSWORD ?? 'demo1234';

async function main() {
  console.log(`[demo] login ${EMAIL} → ${API_URL}`);
  const packager = await DataClausPackager.login({
    apiUrl: API_URL,
    email: EMAIL,
    password: PASSWORD,
  });

  const fixturePath = resolve(__dirname, 'fixtures', 'workouts.json');
  const rows = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>[];
  console.log(`[demo] loaded ${rows.length} rows from ${fixturePath}`);

  const exporter = packager.recurring({
    category: 'fitness',
    basePrice: 49.99,
    titleTemplate: 'Workout Data — Week of {start}',
    description: 'Aggregated workout sessions from Fit & Move users.',
    userField: 'user_id',
    timestampField: 'timestamp',
  });

  const result = await exporter.publish(rows);
  console.log(`[demo] ✓ package ${result.id} → status: ${result.status}`);
  console.log(`[demo]   /marketplace/${result.id}`);
}

main().catch((err) => {
  console.error('[demo] failed:', err);
  process.exitCode = 1;
});
```

- [ ] **Step 11.4: Commit**

```bash
git add scripts/generate-workout-fixture.ts scripts/fixtures/workouts.json scripts/demo-sdk-export.ts
git commit -m "feat(scripts): demo-sdk-export end-to-end against running API"
```

---

## Task 12: Acceptance check

**Files:**
- (No code changes unless a failure is found.)

- [ ] **Step 12.1: Make sure the API is running and seeded**

In one terminal:
```bash
cd /Users/tahacancelebi/Desktop/data_claus-monorepo && pnpm run dev:api
```
Wait until the log shows `Nest application successfully started`.

In another terminal, seed:
```bash
cd /Users/tahacancelebi/Desktop/data_claus-monorepo && pnpm run demo:seed
```
Expected: seed completes without error and prints credentials, including `developer.fitness@dataclaus.demo / demo1234`.

- [ ] **Step 12.2: Run the demo script — acceptance criteria 1**

```bash
cd /Users/tahacancelebi/Desktop/data_claus-monorepo && pnpm exec ts-node --transpile-only --project scripts/tsconfig.json scripts/demo-sdk-export.ts
```

Expected:
- `[demo] login developer.fitness@dataclaus.demo → http://localhost:3000`
- `[demo] loaded 1247 rows from .../scripts/fixtures/workouts.json`
- `[demo] ✓ package pkg_<uuid> → status: evaluating`
- `[demo]   /marketplace/pkg_<uuid>`

Save the printed package id; use it in 12.4.

- [ ] **Step 12.3: Run a second time — acceptance criteria 2 (distinct packages)**

```bash
pnpm exec ts-node --transpile-only --project scripts/tsconfig.json scripts/demo-sdk-export.ts
```

Expected: a different package id; both should appear when you query `/v1/packages/mine` (via curl or the web dashboard).

- [ ] **Step 12.4: Verify the package reaches `certified` and shows in the marketplace UI**

Wait ~10 s, then open `http://localhost:3000/dashboard/packages` while logged in as the demo developer in a browser. The new package should be visible with a real LLM-generated score.

Open `http://localhost:3000/marketplace/<id>` while logged in as a buyer (or unauthenticated — the route is public for certified) — the package should be reachable.

- [ ] **Step 12.5: Regression — web form still works (acceptance criteria 8)**

In the web dashboard, navigate to `/dashboard/packages/new`, paste a minimal JSON sample (5 rows), submit. Confirm 201 and that the new package shows up alongside the SDK-created ones.

- [ ] **Step 12.6: Run the full SDK test suite once more, fresh**

```bash
cd packages/sdk-node && npx jest && npx tsc --noEmit
```

Expected: 34 passing tests, no tsc errors.

- [ ] **Step 12.7: Final commit (only if any fixes were needed during 12.1–12.6)**

If a step revealed an actual issue, fix it in the appropriate file, re-run the relevant Jest test, and commit with `fix(sdk-node): ...`. Otherwise, no commit — acceptance is achieved.

---

## Self-Review

**Spec coverage:**
- §3 Architecture → Tasks 6, 8, 11 (the demo proves the flow).
- §4 SDK API: `create()` → Task 6; `login()` → Task 7; `recurring()` + `RecurringExporter` → Task 8; helpers public-exported → Task 9.
- §5 Auth (Bearer + login) → Tasks 6, 7.
- §6 Inference rules: schema → Task 3; sample → Task 4; metrics → Task 5.
- §7 Title templating → Task 8.
- §8 Error handling (`PackagerError`, four codes) → Tasks 4, 6.
- §9 File table → matches "File Structure" section here.
- §10 Demo script → Task 11.
- §11 Acceptance criteria 1–8 → Task 12 steps map 1:1.
- §12 Risks → no implementation task; risks are mitigated by design choices already in the tasks.

**Placeholder scan:** no TBD / TODO / "appropriate" / "similar to" / "etc." — every step has concrete code and exact commands.

**Type/identifier consistency:**
- `PackagerError` constructor signature is identical in Tasks 4 (`new PackagerError('VALIDATION', msg)`) and 6 (used inside `create`).
- `CreatePackageResult` shape `{ id, status }` is consistent across Tasks 6, 7, 8.
- `RecurringTemplate.titleTemplate` placeholder names `{start}`/`{end}` match between Task 8 implementation and Task 11 demo script.
- Helper exports in Task 9 match the file-level exports from Tasks 3–5.
