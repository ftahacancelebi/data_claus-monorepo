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
