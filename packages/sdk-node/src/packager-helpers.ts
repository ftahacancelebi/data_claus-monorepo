import type { Row, SchemaJson, ClaimedMetrics } from './types';
import { PackagerError } from './packager-errors';

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
