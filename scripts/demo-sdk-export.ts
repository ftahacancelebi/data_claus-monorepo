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
