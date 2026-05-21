import { buildBehaviorDimension, pseudonymize, WatchEventRow } from './dimension-extractor.helpers';

describe('dimension-extractor helpers', () => {
  it('pseudonymize is deterministic per (user, app)', () => {
    expect(pseudonymize('u1', 'a1')).toEqual(pseudonymize('u1', 'a1'));
    expect(pseudonymize('u1', 'a1')).not.toEqual(pseudonymize('u1', 'a2'));
    expect(pseudonymize('u1', 'a1')).toMatch(/^u_[0-9a-f]{8}$/);
  });

  it('behavior sampler stratifies completed + bounces + rest', () => {
    const rows: WatchEventRow[] = Array.from({ length: 20 }, (_, i) => ({
      user_id: `u${i}`,
      video_id: `v${i}`,
      video_tags: [],
      video_category: null,
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
