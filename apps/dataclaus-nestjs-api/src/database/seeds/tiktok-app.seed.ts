import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Developer } from '../../modules/developer/entities/developer.entity';
import { Application } from '../../modules/application/entities/application.entity';
import { Wallet } from '../../modules/wallet/entities/wallet.entity';
import { WalletType } from '../../common/constants';

const logger = new Logger('TikTokAppSeed');

// Fixed UUID — must match apps/tiktok-backend/.env DATACLAUS_APP_ID.
// Deterministic so the money-loop works on first boot without running demo:seed.
export const TIKTOK_CLONE_APP_ID = 'b6ee3a76-5863-45f0-84cf-f10dd55423f5';

const DEVELOPER_EMAIL = 'developer.social@dataclaus.demo';
const DEVELOPER_NAME = 'TikTok Clone Inc.';
const DEVELOPER_SHARE = 85;

/**
 * Idempotent: ensures the TikTok Clone developer account and application row
 * exist with the fixed UUID. Called on every API boot so the money-loop
 * (slot → seal → revenue distribution) works immediately after `docker compose up`
 * without having to run `demo:seed` first.
 *
 * demo:seed still creates the full demo dataset (historical impressions, users,
 * packages, etc.) — this seed only guarantees the minimum required for live ad revenue.
 */
export async function ensureTikTokApp(dataSource: DataSource): Promise<void> {
  const devRepo = dataSource.getRepository(Developer);
  const appRepo = dataSource.getRepository(Application);
  const walletRepo = dataSource.getRepository(Wallet);

  // 1. Ensure developer exists
  let dev = await devRepo.findOne({ where: { email: DEVELOPER_EMAIL } });
  if (!dev) {
    const passwordHash = await bcrypt.hash('demo1234', 10);
    dev = await devRepo.save(
      devRepo.create({
        email: DEVELOPER_EMAIL,
        name: DEVELOPER_NAME,
        password: passwordHash,
        userSharePercent: DEVELOPER_SHARE,
      }),
    );
    logger.log(`Seeded developer: ${DEVELOPER_NAME} (${dev.id})`);
  }

  // 2. Ensure developer wallet
  const existingWallet = await walletRepo.findOne({ where: { ownerId: dev.id } });
  if (!existingWallet) {
    await walletRepo.save(
      walletRepo.create({
        ownerId: dev.id,
        type: WalletType.DEVELOPER,
        balance: 0,
        pendingBalance: 0,
        currency: 'USD',
      }),
    );
  }

  // 3. Ensure application with fixed UUID
  const existingApp = await appRepo.findOne({ where: { id: TIKTOK_CLONE_APP_ID } });
  if (!existingApp) {
    await appRepo.save(
      appRepo.create({
        id: TIKTOK_CLONE_APP_ID,
        developerId: dev.id,
        name: 'TikTok Clone',
        description: 'Short-form video social demo',
        category: 'social',
        isActive: true,
        userSharePercent: DEVELOPER_SHARE,
      }),
    );
    logger.log(`Seeded TikTok Clone app (${TIKTOK_CLONE_APP_ID})`);
  }
}
