import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Wallet } from '../../modules/wallet/entities/wallet.entity';
import {
  SYSTEM_WALLET_IDS,
  SYSTEM_WALLET_INITIAL_BALANCE,
  WalletType,
} from '../../common/constants';

const logger = new Logger('SystemWalletSeed');

const SYSTEM_WALLETS: Array<{ id: string; type: WalletType }> = [
  { id: SYSTEM_WALLET_IDS.PLATFORM, type: WalletType.PLATFORM },
  // Ad network wallet uses FAUCET type (closest semantic match in current
  // enum). It's the source of all ad revenue distributions.
  { id: SYSTEM_WALLET_IDS.AD_NETWORK, type: WalletType.FAUCET },
  // Treasury for in-flight payouts also reuses PLATFORM type.
  { id: SYSTEM_WALLET_IDS.PAYOUT_TREASURY, type: WalletType.PLATFORM },
  // Holding pool for data contributor revenue from package sales.
  { id: SYSTEM_WALLET_IDS.DATA_CONTRIBUTORS, type: WalletType.PLATFORM },
];

/**
 * Idempotent seeder for system/singleton wallets. Safe to call on every
 * boot; existing rows are left untouched.
 */
export async function ensureSystemWallets(
  dataSource: DataSource,
): Promise<void> {
  const repo = dataSource.getRepository(Wallet);
  for (const { id, type } of SYSTEM_WALLETS) {
    const existing = await repo.findOne({ where: { id } });
    if (existing) continue;

    await repo.save(
      repo.create({
        id,
        ownerId: id,
        type,
        balance: SYSTEM_WALLET_INITIAL_BALANCE,
        pendingBalance: 0,
        currency: 'USD',
      }),
    );
    logger.log(`Seeded system wallet ${type} (${id})`);
  }
}
