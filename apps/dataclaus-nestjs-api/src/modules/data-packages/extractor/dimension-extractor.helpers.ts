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
  const completed = rows.filter(r => r.completed).slice(0, 4);
  const bounces = rows.filter(r => !r.completed && r.dwell_ms < 3000).slice(0, 2);
  const usedIds = new Set([...completed, ...bounces].map(r => r.user_id + r.video_id));
  const rest = rows
    .filter(r => !usedIds.has(r.user_id + r.video_id))
    .slice(0, sampleLimit - completed.length - bounces.length);
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
