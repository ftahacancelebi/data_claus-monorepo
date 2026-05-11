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
