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
  DataPackage,
  PackagePurchase,
} from '../apps/dataclaus-nestjs-api/src/modules/data-packages/entities';

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
      DataPackage,
      PackagePurchase,
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
  if (existing) {
    // Top up if the existing wallet is below the target seed balance.
    // Idempotent re-seeds bump buyer wallets without resetting them on every run.
    if (initialBalance > 0 && Number(existing.balance) < initialBalance) {
      existing.balance = initialBalance;
      await repo.save(existing);
    }
    return existing;
  }
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
    await ensureWalletFor(ds, row.id, WalletType.BUYER, 5000);
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

function writeJuryLogin(
  developers: Developer[],
  users: DataClausUser[],
  buyers: Developer[],
  applications: Application[],
): void {
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
    lines.push(`| ${b.name} | ${b.email} | $5000 (seeded) | buyer |`);
  }
  lines.push('');
  lines.push('## Admin');
  lines.push(`- Email: \`${DEMO_ADMIN.email}\``);
  lines.push('- Password: `demo1234`');
  lines.push('');
  lines.push('## Applications');
  lines.push('| Name | App ID | Owner |');
  lines.push('|------|--------|-------|');
  for (const a of applications) {
    const owner = developers.find((d) => d.id === a.developerId)?.name ?? '-';
    lines.push(`| ${a.name} | \`${a.id}\` | ${owner} |`);
  }
  lines.push('');
  lines.push('## Data Marketplace (pivot)');
  lines.push('');
  lines.push('Six packages are pre-seeded across the trust-score spectrum:');
  lines.push('- Two **excellent** (≥0.85): listed at the top of `/dashboard/marketplace`');
  lines.push('- Two **mid** (0.65–0.85): visible with amber score badges');
  lines.push('- One **rejected** (<0.4): only visible in `/dashboard/admin/packages`, with bot-signature red flags');
  lines.push('- One **evaluating**: admin can watch a spinner');
  lines.push('');
  lines.push('Demo flow:');
  lines.push('1. Log in as `developer.fitness@dataclaus.demo` → "Data Packages" → "New Package"');
  lines.push('2. Fill the form (defaults are ready); submit. Status flips from *evaluating* → *certified* in 3–8 s.');
  lines.push('3. Log in as `buyer.brandone@dataclaus.demo` → "Marketplace" → click the new package → "Purchase".');
  lines.push('4. Funds split 95% seller / 5% platform via the existing wallet/ledger primitives.');
  lines.push('');
  lines.push('Smoke test: `pnpm exec ts-node --transpile-only --project scripts/tsconfig.json scripts/smoke-test-package-marketplace.ts`.');
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

/**
 * Seed 6 data packages spanning the score gauge spectrum, with pre-computed
 * LLM evaluations baked into the row so the marketplace is full before the
 * jury demo even begins. The "live submit" demo step adds a 7th package via
 * the real API and exercises the Claude integration.
 *
 * Distribution:
 *   - 2 excellent (≥0.85) — green badges on the marketplace card grid
 *   - 2 mid       (0.65–0.85) — amber, sets up "buyers compare scores"
 *   - 1 rejected  (<0.4)      — red, demonstrates the AI catching a bot
 *   - 1 evaluating — visible spinner if the jury opens admin before live submit
 */
async function seedDataPackages(
  ds: DataSource,
  developers: Developer[],
  applications: Application[],
): Promise<number> {
  const repo = ds.getRepository(DataPackage);

  const devByName = (n: string) =>
    developers.find((d) => d.name === n) ?? developers[0];
  const appForDev = (devId: string) =>
    applications.find((a) => a.developerId === devId);

  const fitnessDev = devByName('Fit & Move Labs');
  const socialDev = devByName('TikTok Clone Inc.');
  const cinemaDev = devByName('Cinema Studios Inc.');

  const seeds: Array<{
    developerId: string;
    applicationId: string | null;
    title: string;
    description: string;
    category: string;
    claimedMetrics: {
      row_count: number;
      unique_users: number;
      date_range_start: string;
      date_range_end: string;
    };
    schemaJson: Record<string, string>;
    sampleRows: Record<string, unknown>[];
    price: number;
    status: 'certified' | 'rejected' | 'evaluating';
    score: number | null;
    summary: string;
    redFlags: string[];
    buyerMatch: string[];
    rubric: {
      schema_integrity: number;
      sample_diversity: number;
      bot_signature_absence: number;
      claim_evidence_alignment: number;
      price_fairness: number;
    };
    confidence: 'high' | 'medium' | 'low';
  }> = [
    // 1) Excellent fitness package
    {
      developerId: fitnessDev.id,
      applicationId: appForDev(fitnessDev.id)?.id ?? null,
      title: 'iOS Fitness Engagement Sessions Q4 2025',
      description:
        'Daily activity sessions with movement classification and session length, opt-in users only.',
      category: 'fitness',
      claimedMetrics: {
        row_count: 18420,
        unique_users: 2140,
        date_range_start: '2025-10-01',
        date_range_end: '2025-12-31',
      },
      schemaJson: {
        user_id: 'string',
        session_seconds: 'number',
        activity_type: 'string',
        intensity_score: 'number',
        recorded_at: 'timestamp',
      },
      sampleRows: [
        { user_id: 'u_a8c1', session_seconds: 312, activity_type: 'run', intensity_score: 0.72, recorded_at: '2025-10-04T07:14:21Z' },
        { user_id: 'u_91ec', session_seconds: 188, activity_type: 'cycle', intensity_score: 0.55, recorded_at: '2025-10-04T08:02:11Z' },
        { user_id: 'u_5fa0', session_seconds: 905, activity_type: 'gym', intensity_score: 0.88, recorded_at: '2025-10-04T19:30:00Z' },
        { user_id: 'u_c2d9', session_seconds: 421, activity_type: 'walk', intensity_score: 0.34, recorded_at: '2025-10-05T06:55:43Z' },
        { user_id: 'u_77bb', session_seconds: 250, activity_type: 'run', intensity_score: 0.68, recorded_at: '2025-10-05T18:11:09Z' },
        { user_id: 'u_1d3e', session_seconds: 612, activity_type: 'gym', intensity_score: 0.81, recorded_at: '2025-10-06T07:00:00Z' },
      ],
      price: 89.0,
      status: 'certified',
      score: 0.91,
      summary:
        'Strong fitness sessions dataset with consistent schema across the full quarter; distinct users dominate and intensity scores show realistic variance. Worth the asking price for ad targeting in health verticals.',
      redFlags: [],
      buyerMatch: ['fitness-apparel', 'wearable-hardware', 'wellness-coaching'],
      rubric: { schema_integrity: 0.95, sample_diversity: 0.92, bot_signature_absence: 0.94, claim_evidence_alignment: 0.90, price_fairness: 0.82 },
      confidence: 'high',
    },
    // 2) Excellent entertainment package
    {
      developerId: cinemaDev.id,
      applicationId: appForDev(cinemaDev.id)?.id ?? null,
      title: 'Streaming View Completion & Genre Affinity (Q4 2025)',
      description:
        'Per-session completion ratios and genre preference scores. Users explicitly consented to anonymized resale.',
      category: 'entertainment',
      claimedMetrics: {
        row_count: 26100,
        unique_users: 3010,
        date_range_start: '2025-10-01',
        date_range_end: '2025-12-31',
      },
      schemaJson: {
        user_id: 'string',
        title_id: 'string',
        completion_ratio: 'number',
        genre: 'string',
        watched_at: 'timestamp',
      },
      sampleRows: [
        { user_id: 'u_b201', title_id: 't_dune2', completion_ratio: 0.93, genre: 'sci-fi', watched_at: '2025-10-14T21:31:01Z' },
        { user_id: 'u_de77', title_id: 't_qos2', completion_ratio: 0.41, genre: 'documentary', watched_at: '2025-10-15T19:02:23Z' },
        { user_id: 'u_aa31', title_id: 't_dune2', completion_ratio: 0.97, genre: 'sci-fi', watched_at: '2025-10-15T22:18:55Z' },
        { user_id: 'u_4f0c', title_id: 't_oppen', completion_ratio: 0.86, genre: 'drama', watched_at: '2025-10-16T20:11:09Z' },
        { user_id: 'u_e511', title_id: 't_planet', completion_ratio: 0.72, genre: 'documentary', watched_at: '2025-10-16T18:00:00Z' },
        { user_id: 'u_7732', title_id: 't_johnw', completion_ratio: 0.55, genre: 'action', watched_at: '2025-10-17T22:45:21Z' },
      ],
      price: 129.0,
      status: 'certified',
      score: 0.88,
      summary:
        'Streaming completion + genre affinity is rare to find at this resolution; the time distribution matches typical evening viewing patterns. Useful for streaming-adjacent advertisers and recommendation engine bootstraps.',
      redFlags: [],
      buyerMatch: ['streaming-services', 'advertising-targeting', 'media-research'],
      rubric: { schema_integrity: 0.92, sample_diversity: 0.88, bot_signature_absence: 0.92, claim_evidence_alignment: 0.88, price_fairness: 0.74 },
      confidence: 'high',
    },
    // 3) Mid social engagement
    {
      developerId: socialDev.id,
      applicationId: appForDev(socialDev.id)?.id ?? null,
      title: 'Short-form Scroll Sessions (Top-100 Creators Excluded)',
      description:
        'Per-session scroll depth, like/share counts, and time-on-content for a TikTok-style feed.',
      category: 'social',
      claimedMetrics: {
        row_count: 41200,
        unique_users: 1820,
        date_range_start: '2025-11-01',
        date_range_end: '2025-12-15',
      },
      schemaJson: {
        user_id: 'string',
        session_id: 'string',
        videos_viewed: 'number',
        avg_view_seconds: 'number',
        likes: 'number',
        recorded_at: 'timestamp',
      },
      sampleRows: [
        { user_id: 'u_22aa', session_id: 's_1', videos_viewed: 124, avg_view_seconds: 14.3, likes: 12, recorded_at: '2025-11-02T20:11:00Z' },
        { user_id: 'u_22aa', session_id: 's_2', videos_viewed: 58, avg_view_seconds: 22.5, likes: 4, recorded_at: '2025-11-03T19:01:00Z' },
        { user_id: 'u_91ce', session_id: 's_3', videos_viewed: 211, avg_view_seconds: 9.8, likes: 31, recorded_at: '2025-11-03T22:30:00Z' },
        { user_id: 'u_4520', session_id: 's_4', videos_viewed: 87, avg_view_seconds: 18.1, likes: 7, recorded_at: '2025-11-04T18:14:00Z' },
        { user_id: 'u_88da', session_id: 's_5', videos_viewed: 305, avg_view_seconds: 7.4, likes: 41, recorded_at: '2025-11-04T21:55:00Z' },
        { user_id: 'u_91ce', session_id: 's_6', videos_viewed: 162, avg_view_seconds: 12.6, likes: 18, recorded_at: '2025-11-05T20:00:00Z' },
      ],
      price: 39.0,
      status: 'certified',
      score: 0.74,
      summary:
        'Solid short-form engagement signal but the user-to-row ratio leans heavy — ~22 rows per user suggests power-user bias. Good for retention modeling, weaker for net-new reach segmentation.',
      redFlags: ['Power-user bias — 5 of 1820 users contribute ~12% of sessions'],
      buyerMatch: ['social-commerce', 'creator-economy', 'feed-recsys'],
      rubric: { schema_integrity: 0.84, sample_diversity: 0.62, bot_signature_absence: 0.78, claim_evidence_alignment: 0.78, price_fairness: 0.81 },
      confidence: 'medium',
    },
    // 4) Mid location package
    {
      developerId: fitnessDev.id,
      applicationId: appForDev(fitnessDev.id)?.id ?? null,
      title: 'Aggregate Run Routes — Istanbul Metro Area',
      description:
        'Anonymized run start/end points binned to 500 m grids. Useful for outdoor brand placement planning.',
      category: 'location',
      claimedMetrics: {
        row_count: 5400,
        unique_users: 612,
        date_range_start: '2025-09-01',
        date_range_end: '2025-12-15',
      },
      schemaJson: {
        run_id: 'string',
        user_id: 'string',
        start_grid: 'string',
        end_grid: 'string',
        distance_km: 'number',
        started_at: 'timestamp',
      },
      sampleRows: [
        { run_id: 'r_001', user_id: 'u_a01', start_grid: 'IST_41.04_29.00', end_grid: 'IST_41.05_29.02', distance_km: 4.8, started_at: '2025-09-04T07:00:00Z' },
        { run_id: 'r_002', user_id: 'u_a01', start_grid: 'IST_41.04_29.00', end_grid: 'IST_41.06_29.02', distance_km: 6.2, started_at: '2025-09-05T07:00:00Z' },
        { run_id: 'r_003', user_id: 'u_b12', start_grid: 'IST_40.99_29.04', end_grid: 'IST_41.00_29.06', distance_km: 5.1, started_at: '2025-09-05T18:30:00Z' },
        { run_id: 'r_004', user_id: 'u_c19', start_grid: 'IST_41.07_28.96', end_grid: 'IST_41.08_28.98', distance_km: 7.0, started_at: '2025-09-06T06:50:00Z' },
        { run_id: 'r_005', user_id: 'u_d77', start_grid: 'IST_41.02_29.10', end_grid: 'IST_41.04_29.12', distance_km: 9.4, started_at: '2025-09-06T20:00:00Z' },
        { run_id: 'r_006', user_id: 'u_b12', start_grid: 'IST_40.99_29.04', end_grid: 'IST_41.01_29.06', distance_km: 5.6, started_at: '2025-09-07T07:00:00Z' },
      ],
      price: 49.0,
      status: 'certified',
      score: 0.69,
      summary:
        'Useful for outdoor brand and event-venue planning, but the grid resolution and small unique-user count limit segmentation depth. Price is reasonable for the geographic specificity.',
      redFlags: ['Single-city coverage may not generalize'],
      buyerMatch: ['outdoor-apparel', 'event-marketing', 'urban-planning'],
      rubric: { schema_integrity: 0.80, sample_diversity: 0.70, bot_signature_absence: 0.85, claim_evidence_alignment: 0.65, price_fairness: 0.55 },
      confidence: 'medium',
    },
    // 5) Rejected bot-pattern package
    {
      developerId: socialDev.id,
      applicationId: appForDev(socialDev.id)?.id ?? null,
      title: 'High-Volume Like Events — Premium Engagement Pack',
      description:
        'Aggressively high engagement counts across a viral creator cohort.',
      category: 'social',
      claimedMetrics: {
        row_count: 250000,
        unique_users: 412,
        date_range_start: '2025-12-01',
        date_range_end: '2025-12-03',
      },
      schemaJson: {
        user_id: 'string',
        creator_id: 'string',
        likes: 'number',
        clicked_at: 'timestamp',
      },
      sampleRows: [
        { user_id: 'u_b0t1', creator_id: 'c_big1', likes: 999, clicked_at: '2025-12-01T12:00:00Z' },
        { user_id: 'u_b0t2', creator_id: 'c_big1', likes: 999, clicked_at: '2025-12-01T12:00:00Z' },
        { user_id: 'u_b0t3', creator_id: 'c_big1', likes: 999, clicked_at: '2025-12-01T12:00:00Z' },
        { user_id: 'u_b0t4', creator_id: 'c_big1', likes: 1000, clicked_at: '2025-12-01T12:00:01Z' },
        { user_id: 'u_b0t5', creator_id: 'c_big1', likes: 1000, clicked_at: '2025-12-01T12:00:01Z' },
        { user_id: 'u_b0t6', creator_id: 'c_big1', likes: 1000, clicked_at: '2025-12-01T12:00:01Z' },
      ],
      price: 9.0,
      status: 'rejected',
      score: 0.21,
      summary:
        'The sample shows uniform like counts at identical timestamps — a clear bot signature. 250k rows for only 412 users in 3 days is implausible for real human engagement, and the round-number values reinforce the suspicion.',
      redFlags: [
        'Identical like values (999, 1000) across distinct users',
        'Timestamp clustering with sub-second granularity',
        'Row-to-user ratio (~607:1) implausible for human engagement',
        'No diversity in creator_id across samples',
      ],
      buyerMatch: ['none'],
      rubric: { schema_integrity: 0.55, sample_diversity: 0.10, bot_signature_absence: 0.05, claim_evidence_alignment: 0.20, price_fairness: 0.60 },
      confidence: 'high',
    },
    // 6) Evaluating-state package (mid-demo placeholder)
    {
      developerId: cinemaDev.id,
      applicationId: appForDev(cinemaDev.id)?.id ?? null,
      title: 'Trailer Engagement — Pre-Release Audience Segments',
      description:
        'Per-user trailer dwell time and skip rate for upcoming Q1 2026 releases.',
      category: 'entertainment',
      claimedMetrics: {
        row_count: 8400,
        unique_users: 1240,
        date_range_start: '2025-12-01',
        date_range_end: '2026-01-15',
      },
      schemaJson: {
        user_id: 'string',
        trailer_id: 'string',
        dwell_seconds: 'number',
        skipped: 'boolean',
        watched_at: 'timestamp',
      },
      sampleRows: [
        { user_id: 'u_p01', trailer_id: 'tr_001', dwell_seconds: 31, skipped: false, watched_at: '2025-12-04T19:01:00Z' },
        { user_id: 'u_p02', trailer_id: 'tr_001', dwell_seconds: 9, skipped: true, watched_at: '2025-12-04T19:01:00Z' },
        { user_id: 'u_p03', trailer_id: 'tr_002', dwell_seconds: 25, skipped: false, watched_at: '2025-12-04T20:11:00Z' },
        { user_id: 'u_p04', trailer_id: 'tr_002', dwell_seconds: 14, skipped: true, watched_at: '2025-12-04T20:11:00Z' },
        { user_id: 'u_p05', trailer_id: 'tr_003', dwell_seconds: 27, skipped: false, watched_at: '2025-12-05T18:00:00Z' },
      ],
      price: 24.0,
      status: 'evaluating',
      score: null,
      summary: '',
      redFlags: [],
      buyerMatch: [],
      rubric: { schema_integrity: 0, sample_diversity: 0, bot_signature_absence: 0, claim_evidence_alignment: 0, price_fairness: 0 },
      confidence: 'low',
    },
  ];

  let created = 0;
  for (const s of seeds) {
    const existing = await repo.findOne({
      where: { developerId: s.developerId, title: s.title },
    });
    if (existing) continue;
    const row = repo.create({
      developerId: s.developerId,
      applicationId: s.applicationId,
      title: s.title,
      description: s.description,
      category: s.category,
      claimedMetrics: s.claimedMetrics,
      schemaJson: s.schemaJson,
      sampleRows: s.sampleRows,
      price: s.price,
      status: s.status,
      dataclausScore: s.score,
      llmEvaluation:
        s.status === 'evaluating'
          ? null
          : {
              trust_score: s.score ?? 0,
              summary: s.summary,
              red_flags: s.redFlags,
              buyer_match: s.buyerMatch.length ? s.buyerMatch : ['general'],
              rubric: s.rubric,
              confidence: s.confidence,
              verdict: s.status === 'certified' ? 'certified' : 'rejected',
            },
      evaluatedAt: s.status === 'evaluating' ? null : new Date(),
    });
    await repo.save(row);
    created += 1;
  }
  return created;
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
    console.log(`  ✓ ${buyers.length} buyers ensured (wallets topped up to $5000)`);

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

    const packageCount = await seedDataPackages(ds, developers, applications);
    console.log(`  ✓ Data packages: ${packageCount} created (6 total in marketplace)`);

    writeJuryLogin(developers, users, buyers, applications);

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
