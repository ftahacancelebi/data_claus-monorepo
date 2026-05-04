/**
 * Phase 7 — Demo Seed Script
 *
 * Idempotent seeder for the capstone demo. Creates predictable, jury-ready
 * data that exercises every part of the platform: developers, applications,
 * end-users, buyers, campaigns, ad impressions, scored events, payouts.
 *
 * Run:
 *   pnpm run demo:seed
 *
 * Re-running is safe — existing rows (matched by deterministic email/UUID)
 * are skipped. Use `pnpm run demo:reset` to wipe everything first.
 *
 * Output:
 *   JURY_LOGIN.md at the repo root with all credentials.
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';

// Entities
import { Developer } from '../apps/dataclaus-nestjs-api/src/modules/developer/entities/developer.entity';
import { ApiKey } from '../apps/dataclaus-nestjs-api/src/modules/developer/entities/api-key.entity';
import { Application } from '../apps/dataclaus-nestjs-api/src/modules/application/entities/application.entity';
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
  WalletType,
  CampaignStatus,
  TransactionType,
  TransactionStatus,
  PayoutStatus,
  PayoutMethod,
  PLATFORM_FEE_PERCENT,
  SYSTEM_WALLET_IDS,
  SYSTEM_WALLET_INITIAL_BALANCE,
} from '../apps/dataclaus-nestjs-api/src/common/constants';

loadEnv({ path: join(__dirname, '..', 'apps', 'dataclaus-nestjs-api', '.env') });

const DEMO_PASSWORD = 'demo1234';
const DEMO_TAG = 'demo';

const DEMO_DEVELOPERS = [
  {
    email: 'developer.cinema@dataclaus.demo',
    name: 'Cinema Studios Inc.',
    userSharePercent: 60,
  },
  {
    email: 'developer.fitness@dataclaus.demo',
    name: 'Fit & Move Labs',
    userSharePercent: 70,
  },
  {
    email: 'developer.social@dataclaus.demo',
    name: 'TikTok Clone Inc.',
    userSharePercent: 85,
  },
];

const DEMO_USERS = [
  { email: 'user.alice@dataclaus.demo', displayName: 'Alice Yılmaz' },
  { email: 'user.bob@dataclaus.demo', displayName: 'Bob Demir' },
  { email: 'user.cem@dataclaus.demo', displayName: 'Cem Kaya' },
  { email: 'user.deniz@dataclaus.demo', displayName: 'Deniz Aydın' },
  { email: 'user.elif@dataclaus.demo', displayName: 'Elif Korkmaz' },
];

const DEMO_BUYERS = [
  { email: 'buyer.brandone@dataclaus.demo', name: 'BrandOne Marketing' },
  { email: 'buyer.acme@dataclaus.demo', name: 'ACME Data Co.' },
];

const DEMO_ADMIN = {
  email: 'admin@dataclaus.demo',
  name: 'Demo Admin',
};

const AD_TYPES: AdType[] = [AdType.BANNER, AdType.INTERSTITIAL, AdType.REWARDED];

interface SeedResult {
  developers: Developer[];
  applications: Application[];
  users: DataClausUser[];
  buyers: Developer[]; // Buyers reuse Developer entity for now
  campaigns: Campaign[];
  impressionCount: number;
  scoredEventCount: number;
  payoutCount: number;
}

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

async function ensureSystemWallets(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(Wallet);
  const wallets = [
    { id: SYSTEM_WALLET_IDS.PLATFORM, type: WalletType.PLATFORM },
    { id: SYSTEM_WALLET_IDS.AD_NETWORK, type: WalletType.FAUCET },
    { id: SYSTEM_WALLET_IDS.PAYOUT_TREASURY, type: WalletType.PLATFORM },
  ];
  for (const w of wallets) {
    const existing = await repo.findOne({ where: { id: w.id } });
    if (existing) continue;
    await repo.save(
      repo.create({
        id: w.id,
        ownerId: w.id,
        type: w.type,
        balance: SYSTEM_WALLET_INITIAL_BALANCE,
        pendingBalance: 0,
        currency: 'USD',
      }),
    );
  }
}

async function ensureWalletFor(
  ds: DataSource,
  ownerId: string,
  type: WalletType,
  initialBalance = 0,
): Promise<Wallet> {
  const repo = ds.getRepository(Wallet);
  const existing = await repo.findOne({ where: { ownerId } });
  if (existing) return existing;
  return repo.save(
    repo.create({
      ownerId,
      type,
      balance: initialBalance,
      pendingBalance: 0,
      currency: 'USD',
    }),
  );
}

async function seedDevelopers(ds: DataSource): Promise<Developer[]> {
  const repo = ds.getRepository(Developer);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const result: Developer[] = [];
  for (const dev of DEMO_DEVELOPERS) {
    let row = await repo.findOne({ where: { email: dev.email } });
    if (!row) {
      row = await repo.save(
        repo.create({
          email: dev.email,
          name: dev.name,
          password: passwordHash,
          userSharePercent: dev.userSharePercent,
        }),
      );
    }
    await ensureWalletFor(ds, row.id, WalletType.DEVELOPER);
    result.push(row);
  }
  return result;
}

async function seedBuyers(ds: DataSource): Promise<Developer[]> {
  const repo = ds.getRepository(Developer);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const result: Developer[] = [];
  for (const buyer of DEMO_BUYERS) {
    let row = await repo.findOne({ where: { email: buyer.email } });
    if (!row) {
      row = await repo.save(
        repo.create({
          email: buyer.email,
          name: buyer.name,
          password: passwordHash,
          userSharePercent: 70,
        }),
      );
    }
    await ensureWalletFor(ds, row.id, WalletType.BUYER, 500);
    result.push(row);
  }
  return result;
}

async function seedAdmin(ds: DataSource): Promise<Developer> {
  const repo = ds.getRepository(Developer);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let row = await repo.findOne({ where: { email: DEMO_ADMIN.email } });
  if (!row) {
    row = await repo.save(
      repo.create({
        email: DEMO_ADMIN.email,
        name: DEMO_ADMIN.name,
        password: passwordHash,
        userSharePercent: 70,
      }),
    );
  }
  await ensureWalletFor(ds, row.id, WalletType.PLATFORM, 0);
  return row;
}

async function seedApplications(
  ds: DataSource,
  developers: Developer[],
): Promise<Application[]> {
  const repo = ds.getRepository(Application);
  const apiKeyRepo = ds.getRepository(ApiKey);
  const apps: Array<{
    name: string;
    description: string;
    category: string;
    devIdx: number;
    sharePercent: number;
  }> = [
    {
      name: 'Cinema+ Streaming',
      description: 'Movie & series streaming with cinema mode',
      category: 'entertainment',
      devIdx: 0,
      sharePercent: 60,
    },
    {
      name: 'FitMove Tracker',
      description: 'Daily fitness & step tracker',
      category: 'health',
      devIdx: 1,
      sharePercent: 70,
    },
    {
      name: 'TikTok Clone',
      description: 'Short-form video social demo',
      category: 'social',
      devIdx: 2,
      sharePercent: 85,
    },
  ];

  const result: Application[] = [];
  for (const a of apps) {
    const dev = developers[a.devIdx];
    let app = await repo.findOne({
      where: { developerId: dev.id, name: a.name },
    });
    if (!app) {
      app = await repo.save(
        repo.create({
          developerId: dev.id,
          name: a.name,
          description: a.description,
          category: a.category,
          isActive: true,
          userSharePercent: a.sharePercent,
        }),
      );
    }

    const existingKey = await apiKeyRepo.findOne({
      where: { developerId: dev.id, applicationId: app.id },
    });
    if (!existingKey) {
      const prefix = `dck_${app.id.replace(/-/g, '').slice(0, 8)}`;
      const rawKey = `${prefix}_${app.id.replace(/-/g, '')}`;
      await apiKeyRepo.save(
        apiKeyRepo.create({
          developerId: dev.id,
          applicationId: app.id,
          name: `${a.name} API Key`,
          keyPrefix: prefix,
          keyHash: await bcrypt.hash(rawKey, 10),
          isActive: true,
        } as Partial<ApiKey>),
      );
    }

    result.push(app);
  }
  return result;
}

async function seedUsers(ds: DataSource): Promise<DataClausUser[]> {
  const repo = ds.getRepository(DataClausUser);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const result: DataClausUser[] = [];
  for (const u of DEMO_USERS) {
    let row = await repo.findOne({ where: { email: u.email } });
    if (!row) {
      row = await repo.save(
        repo.create({
          email: u.email,
          emailVerified: true,
          passwordHash,
          displayName: u.displayName,
          qualityScore: 0.5 + Math.random() * 0.45,
        }),
      );
    }
    const wallet = await ensureWalletFor(ds, row.id, WalletType.USER);
    if (row.walletId !== wallet.id) {
      row.walletId = wallet.id;
      await repo.save(row);
    }
    result.push(row);
  }
  return result;
}

async function seedCampaigns(
  ds: DataSource,
  buyers: Developer[],
): Promise<Campaign[]> {
  const repo = ds.getRepository(Campaign);
  const campaigns: Array<{
    name: string;
    description: string;
    budget: number;
    bid: number;
    targetingCategories: string[];
    buyerIdx: number;
  }> = [
    {
      name: 'Cinema Premiere Launch',
      description: 'Reach movie lovers with premiere trailers',
      budget: 200,
      bid: 0.05,
      targetingCategories: ['entertainment'],
      buyerIdx: 0,
    },
    {
      name: 'FitGoals 2026',
      description: 'Targeted ads for fitness enthusiasts',
      budget: 150,
      bid: 0.03,
      targetingCategories: ['health'],
      buyerIdx: 0,
    },
    {
      name: 'Social Pulse Q2',
      description: 'Brand awareness on social demo',
      budget: 250,
      bid: 0.04,
      targetingCategories: ['social'],
      buyerIdx: 1,
    },
  ];

  const result: Campaign[] = [];
  for (const c of campaigns) {
    let row = await repo.findOne({
      where: { buyerId: buyers[c.buyerIdx].id, name: c.name },
    });
    if (!row) {
      row = await repo.save(
        repo.create({
          buyerId: buyers[c.buyerIdx].id,
          name: c.name,
          description: c.description,
          totalBudget: c.budget,
          remaining: c.budget,
          spentBudget: 0,
          bidPerImpression: c.bid,
          targeting: { appCategories: c.targetingCategories },
          status: CampaignStatus.ACTIVE,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }),
      );
    }
    result.push(row);
  }
  return result;
}

async function seedAdImpressions(
  ds: DataSource,
  applications: Application[],
  users: DataClausUser[],
  developers: Developer[],
): Promise<number> {
  const repo = ds.getRepository(AdImpression);

  const existing = await repo.count();
  if (existing >= 100) {
    return existing;
  }

  const toInsert = 100 - existing;
  let inserted = 0;

  for (let i = 0; i < toInsert; i++) {
    const app = applications[i % applications.length];
    const user = users[i % users.length];
    const dev = developers.find((d) => d.id === app.developerId);
    if (!dev) continue;
    const adType = AD_TYPES[i % AD_TYPES.length];
    const gross = AdImpression.getRevenuePerImpression(adType);
    const userShare = (gross * app.userSharePercent) / 100;
    const platformFee = (gross * PLATFORM_FEE_PERCENT) / 100;
    const devShare = gross - userShare - platformFee;
    const daysAgo = Math.floor(Math.random() * 7);
    const created = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
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
        distributedAt: created,
        currency: 'USD',
        createdAt: created,
        updatedAt: created,
      } as Partial<AdImpression>),
    );
    inserted++;
  }
  return inserted;
}

async function seedScoredEvents(
  ds: DataSource,
  applications: Application[],
  users: DataClausUser[],
  developers: Developer[],
): Promise<number> {
  const repo = ds.getRepository(ScoredEvent);
  const existing = await repo.count();
  if (existing >= 50) return existing;

  const toInsert = 50 - existing;
  let inserted = 0;
  const eventTypes = [
    'accelerometer',
    'gyroscope',
    'touch',
    'scroll',
    'screen_view',
  ];
  for (let i = 0; i < toInsert; i++) {
    const app = applications[i % applications.length];
    const user = users[i % users.length];
    const dev = developers.find((d) => d.id === app.developerId);
    if (!dev) continue;
    const isBot = i % 7 === 0;
    const fraudScore = isBot ? 0.85 + Math.random() * 0.15 : Math.random() * 0.4;
    const qualityScore = 1 - fraudScore;
    const eventType = eventTypes[i % eventTypes.length];
    try {
      const ingestedAt = new Date();
      await repo.save(
        repo.create({
          applicationId: app.id,
          userId: user.id,
          developerId: dev.id,
          eventId: `demo-${Date.now()}-${i}`,
          eventType,
          fraudScore,
          qualityScore,
          payoutAmount: qualityScore * 0.0005,
          status: isBot ? 'rejected' : 'scored',
          rejectionReason: isBot ? 'fraud_score_threshold' : null,
          ingestedAt,
          scoredAt: isBot ? null : ingestedAt,
        } as Partial<ScoredEvent>),
      );
      inserted++;
    } catch {
      // Schema may differ slightly across migrations — skip individual failures.
      continue;
    }
  }
  return inserted;
}

async function seedPayouts(
  ds: DataSource,
  users: DataClausUser[],
): Promise<number> {
  const repo = ds.getRepository(PayoutRequest);
  const existing = await repo.count();
  if (existing >= 2) return existing;

  const walletRepo = ds.getRepository(Wallet);
  const toCreate = [
    { user: users[0], amount: 5.5, status: PayoutStatus.COMPLETED },
    { user: users[1], amount: 3.25, status: PayoutStatus.REQUESTED },
  ];
  let inserted = 0;
  for (const p of toCreate) {
    const wallet = await walletRepo.findOne({ where: { ownerId: p.user.id } });
    if (!wallet) continue;
    await repo.save(
      repo.create({
        userId: p.user.id,
        walletId: wallet.id,
        amount: p.amount,
        currency: 'USD',
        method: PayoutMethod.BANK_SIMULATION,
        status: p.status,
        requestedAt: new Date(),
        completedAt:
          p.status === PayoutStatus.COMPLETED
            ? new Date(Date.now() - 24 * 60 * 60 * 1000)
            : null,
      } as Partial<PayoutRequest>),
    );
    inserted++;
  }
  return inserted;
}

async function seedWebhookEndpoint(
  ds: DataSource,
  developers: Developer[],
): Promise<void> {
  const repo = ds.getRepository(WebhookEndpoint);
  const secretRepo = ds.getRepository(WebhookSecret);

  for (const dev of developers) {
    const existing = await repo.findOne({ where: { developerId: dev.id } });
    if (existing) continue;
    const ep = await repo.save(
      repo.create({
        developerId: dev.id,
        url: 'https://example.com/dataclaus/webhook',
        eventTypes: ['ad.revenue', 'payout.completed'],
        enabled: true,
      } as Partial<WebhookEndpoint>),
    );
    const secretPrefix = `whsec_${ep.id.replace(/-/g, '').slice(0, 8)}`;
    const secretBody = `${secretPrefix}_${ep.id.replace(/-/g, '')}`;
    try {
      await secretRepo.save(
        secretRepo.create({
          endpointId: ep.id,
          secretPrefix,
          secretHash: await bcrypt.hash(secretBody, 10),
          label: 'demo',
        } as Partial<WebhookSecret>),
      );
    } catch {
      // Secret already exists or schema mismatch — best-effort only.
    }
  }
}

function writeJuryLogin(developers: Developer[], users: DataClausUser[], buyers: Developer[]): void {
  const path = join(__dirname, '..', 'JURY_LOGIN.md');
  const dateStr = new Date().toISOString();
  const lines: string[] = [];
  lines.push('# DataClaus Demo Login Reference');
  lines.push('');
  lines.push(`> Auto-generated by \`pnpm run demo:seed\` at ${dateStr}.`);
  lines.push('> Shared password for ALL accounts: **`demo1234`**.');
  lines.push('');
  lines.push('## Developers');
  lines.push('| Name | Email | User Share | Role |');
  lines.push('|------|-------|------------|------|');
  for (const d of developers) {
    lines.push(`| ${d.name} | ${d.email} | ${d.userSharePercent}% | developer |`);
  }
  lines.push('');
  lines.push('## End Users');
  lines.push('| Display Name | Email | Role |');
  lines.push('|--------------|-------|------|');
  for (const u of users) {
    lines.push(`| ${u.displayName ?? '-'} | ${u.email} | user |`);
  }
  lines.push('');
  lines.push('## Buyers');
  lines.push('| Name | Email | Wallet | Role |');
  lines.push('|------|-------|--------|------|');
  for (const b of buyers) {
    lines.push(`| ${b.name} | ${b.email} | $500 (seeded) | buyer |`);
  }
  lines.push('');
  lines.push('## Admin');
  lines.push(`- Email: \`${DEMO_ADMIN.email}\``);
  lines.push('- Password: `demo1234`');
  lines.push('');
  lines.push('## Quick Reset');
  lines.push('```bash');
  lines.push('pnpm run demo:reset   # wipe demo data + reseed');
  lines.push('pnpm run demo:replay  # generate live impressions for demo');
  lines.push('```');
  lines.push('');
  writeFileSync(path, lines.join('\n'));
  console.log(`📝 Wrote ${path}`);
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log('🌱 DataClaus demo seed — starting...');
  const ds = await buildDataSource();

  try {
    await ensureSystemWallets(ds);
    console.log('  ✓ System wallets ensured');

    const developers = await seedDevelopers(ds);
    console.log(`  ✓ ${developers.length} developers ensured`);

    const buyers = await seedBuyers(ds);
    console.log(`  ✓ ${buyers.length} buyers ensured (wallets topped up to $500)`);

    await seedAdmin(ds);
    console.log('  ✓ Admin ensured');

    const applications = await seedApplications(ds, developers);
    console.log(`  ✓ ${applications.length} applications ensured (with API keys)`);

    const users = await seedUsers(ds);
    console.log(`  ✓ ${users.length} end-users ensured`);

    const campaigns = await seedCampaigns(ds, buyers);
    console.log(`  ✓ ${campaigns.length} campaigns ensured`);

    const impressionCount = await seedAdImpressions(
      ds,
      applications,
      users,
      developers,
    );
    console.log(`  ✓ Ad impressions: ${impressionCount} rows`);

    const scoredEventCount = await seedScoredEvents(
      ds,
      applications,
      users,
      developers,
    );
    console.log(`  ✓ Scored events: ${scoredEventCount} rows`);

    const payoutCount = await seedPayouts(ds, users);
    console.log(`  ✓ Payouts: ${payoutCount} rows`);

    await seedWebhookEndpoint(ds, developers);
    console.log('  ✓ Webhook endpoints ensured');

    writeJuryLogin(developers, users, buyers);

    const tookMs = Date.now() - startedAt;
    console.log(`\n✨ Demo seed complete in ${tookMs}ms`);
    console.log('   See JURY_LOGIN.md for credentials.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('❌ Demo seed failed:', err);
  process.exit(1);
});
