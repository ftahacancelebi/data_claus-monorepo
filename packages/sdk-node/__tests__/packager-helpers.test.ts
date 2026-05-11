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
