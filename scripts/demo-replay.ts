/**
 * Phase 7 — Demo Replay Tool
 *
 * Generates synthetic ad impressions every 5 seconds against the live
 * NestJS API. Used during the capstone demo so dashboards animate even
 * when the actual mobile flow is paused.
 *
 * Run:
 *   pnpm run demo:replay
 *
 * Stops on Ctrl+C. Targets demo users/applications seeded by demo-seed.ts.
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';

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

import {
  AdType,
  PLATFORM_FEE_PERCENT,
} from '../apps/dataclaus-nestjs-api/src/common/constants';

loadEnv({ path: join(__dirname, '..', 'apps', 'dataclaus-nestjs-api', '.env') });

const REPLAY_INTERVAL_MS = parseInt(process.env.REPLAY_INTERVAL_MS || '5000', 10);
const AD_TYPES: AdType[] = [AdType.BANNER, AdType.INTERSTITIAL, AdType.REWARDED];

async function buildDataSource(): Promise<DataSource> {
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
  return ds;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function loadFixtures(ds: DataSource) {
  const apps = await ds.getRepository(Application).find({ where: { isActive: true } });
  const users = await ds.getRepository(DataClausUser).find();
  const devs = await ds.getRepository(Developer).find();
  if (apps.length === 0 || users.length === 0) {
    throw new Error(
      'No demo applications/users found. Run `pnpm run demo:seed` first.',
    );
  }
  return { apps, users, devs };
}

async function tick(ds: DataSource): Promise<void> {
  const { apps, users, devs } = await loadFixtures(ds);
  const repo = ds.getRepository(AdImpression);

  const app = pick(apps);
  const user = pick(users);
  const dev = devs.find((d) => d.id === app.developerId);
  if (!dev) return;
  const adType = pick(AD_TYPES);
  const gross = AdImpression.getRevenuePerImpression(adType);
  const userShare = (gross * app.userSharePercent) / 100;
  const platformFee = (gross * PLATFORM_FEE_PERCENT) / 100;
  const devShare = gross - userShare - platformFee;

  await repo.save(
    repo.create({
      applicationId: app.id,
      userId: user.id,
      developerId: dev.id,
      adType,
      adNetworkName: 'admob',
      grossRevenue: gross,
      userShare,
      devShare,
      platformFee,
      distributed: true,
      distributedAt: new Date(),
      currency: 'USD',
    } as Partial<AdImpression>),
  );

  console.log(
    `📺 ${new Date().toISOString().slice(11, 19)} ${app.name.padEnd(25)} ${user.email.padEnd(35)} ${adType.padEnd(13)} $${gross.toFixed(6)}`,
  );
}

async function main(): Promise<void> {
  console.log(
    `▶️  Demo replay starting (every ${REPLAY_INTERVAL_MS}ms). Ctrl+C to stop.\n`,
  );
  const ds = await buildDataSource();

  let running = true;
  process.on('SIGINT', () => {
    console.log('\n🛑 Replay stopping...');
    running = false;
  });

  while (running) {
    try {
      await tick(ds);
    } catch (err) {
      console.error('  ! tick failed:', (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, REPLAY_INTERVAL_MS));
  }

  await ds.destroy();
  console.log('✓ Replay stopped.');
}

main().catch((err) => {
  console.error('❌ Replay failed:', err);
  process.exit(1);
});
