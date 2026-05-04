/**
 * Phase 7 — Demo Reset Tool
 *
 * Truncates demo-relevant tables in dependency order, then re-runs the
 * seed. Safe for the local Postgres only; refuses to run if NODE_ENV is
 * set to production.
 *
 * Run:
 *   pnpm run demo:reset
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { spawnSync } from 'child_process';

import { Application } from '../apps/dataclaus-nestjs-api/src/modules/application/entities/application.entity';
import { Developer } from '../apps/dataclaus-nestjs-api/src/modules/developer/entities/developer.entity';
import { ApiKey } from '../apps/dataclaus-nestjs-api/src/modules/developer/entities/api-key.entity';
import { Wallet } from '../apps/dataclaus-nestjs-api/src/modules/wallet/entities/wallet.entity';
import { Campaign } from '../apps/dataclaus-nestjs-api/src/modules/campaign/entities/campaign.entity';
import { LedgerTransaction } from '../apps/dataclaus-nestjs-api/src/modules/ledger/entities/ledger-transaction.entity';
import { AdImpression } from '../apps/dataclaus-nestjs-api/src/modules/ads/entities/ad-impression.entity';
import { DataClausUser } from '../apps/dataclaus-nestjs-api/src/modules/dataclaus-user/entities/dataclaus-user.entity';
import { ScoredEvent } from '../apps/dataclaus-nestjs-api/src/modules/ingest/entities/scored-event.entity';
import { PayoutRequest } from '../apps/dataclaus-nestjs-api/src/modules/payout/entities/payout-request.entity';
import { OtpRequest } from '../apps/dataclaus-nestjs-api/src/modules/auth/entities';
import {
  WebhookEndpoint,
  WebhookSecret,
  WebhookDelivery,
} from '../apps/dataclaus-nestjs-api/src/modules/webhook/entities';
import { AuditLog } from '../apps/dataclaus-nestjs-api/src/modules/audit/entities/audit-log.entity';

loadEnv({ path: join(__dirname, '..', 'apps', 'dataclaus-nestjs-api', '.env') });

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Refusing to run reset in production environment.');
  process.exit(1);
}

const TRUNCATE_ORDER = [
  'audit_logs',
  'webhook_deliveries',
  'webhook_secrets',
  'webhook_endpoints',
  'payout_requests',
  'ledger_transactions',
  'ad_impressions',
  'scored_events',
  'campaigns',
  'applications',
  'api_keys',
  'wallets',
  'otp_requests',
  'developers',
  'dataclaus_users',
];

async function main(): Promise<void> {
  console.log('🧹 Demo reset — truncating demo tables...');
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'dataclaus',
    entities: [
      Developer,
      ApiKey,
      Application,
      Wallet,
      Campaign,
      LedgerTransaction,
      AdImpression,
      DataClausUser,
      ScoredEvent,
      PayoutRequest,
      OtpRequest,
      WebhookEndpoint,
      WebhookSecret,
      WebhookDelivery,
      AuditLog,
    ],
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  await ds.query('SET session_replication_role = replica;');
  for (const table of TRUNCATE_ORDER) {
    try {
      await ds.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
      console.log(`  ✓ ${table}`);
    } catch (err) {
      console.warn(`  ! ${table}: ${(err as Error).message}`);
    }
  }
  await ds.query('SET session_replication_role = DEFAULT;');
  await ds.destroy();
  console.log('🧹 Truncate complete.\n');

  console.log('🌱 Re-running demo:seed...');
  const result = spawnSync(
    'npx',
    ['ts-node', '--transpile-only', join(__dirname, 'demo-seed.ts')],
    { stdio: 'inherit', cwd: join(__dirname, '..') },
  );
  process.exit(result.status ?? 0);
}

main().catch((err) => {
  console.error('❌ Demo reset failed:', err);
  process.exit(1);
});
