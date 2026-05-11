import { inferSchema, pickSampleRows, computeClaimedMetrics } from '../src/packager-helpers';
import { PackagerError } from '../src/packager-errors';

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
