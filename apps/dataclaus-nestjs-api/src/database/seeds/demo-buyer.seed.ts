import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Developer } from '../../modules/developer/entities/developer.entity';
import { Wallet } from '../../modules/wallet/entities/wallet.entity';
import { Campaign } from '../../modules/campaign/entities/campaign.entity';
import { AdCreative } from '../../modules/ads/entities/ad-creative.entity';
import { WalletType, CampaignStatus } from '../../common/constants';

const logger = new Logger('DemoBuyerSeed');

export const DEMO_BUYER_EMAIL = 'buyer.demo@dataclaus.demo';

export async function ensureDemoBuyer(dataSource: DataSource): Promise<void> {
  const devRepo = dataSource.getRepository(Developer);
  const walletRepo = dataSource.getRepository(Wallet);
  const campaignRepo = dataSource.getRepository(Campaign);
  const creativeRepo = dataSource.getRepository(AdCreative);

  // 1. Buyer account (Developer entity — single user type available)
  let buyer = await devRepo.findOne({ where: { email: DEMO_BUYER_EMAIL } });
  if (!buyer) {
    const hash = await bcrypt.hash('demo1234', 10);
    buyer = await devRepo.save(
      devRepo.create({
        email: DEMO_BUYER_EMAIL,
        name: 'Nike Türkiye (Demo Buyer)',
        password: hash,
        userSharePercent: 0,
      }),
    );
    logger.log(`Seeded demo buyer: ${buyer.id}`);
  }

  // 2. Buyer wallet (BUYER type, $500 balance)
  const existingWallet = await walletRepo.findOne({
    where: { ownerId: buyer.id, type: WalletType.BUYER },
  });
  if (!existingWallet) {
    await walletRepo.save(
      walletRepo.create({
        ownerId: buyer.id,
        type: WalletType.BUYER,
        balance: 500,
        pendingBalance: 0,
        currency: 'USD',
      }),
    );
    logger.log(`Seeded buyer wallet for ${buyer.id}`);
  }

  // 3. Active AdCreative
  const existingCreative = await creativeRepo.findOne({ where: { isActive: true } });
  if (!existingCreative) {
    await creativeRepo.save(
      creativeRepo.create({
        brandName: 'Nike Türkiye',
        imageUrl: 'https://picsum.photos/seed/nike-demo/800/450',
        ctaText: 'Air Max 2024 — Yeni Sezon Geldi 🔥',
        isActive: true,
        buyerId: buyer.id,
      }),
    );
    logger.log(`Seeded active Nike ad creative`);
  }

  // 4. Active Campaign
  const existingCampaign = await campaignRepo.findOne({
    where: { buyerId: buyer.id, status: CampaignStatus.ACTIVE },
  });
  if (!existingCampaign) {
    await campaignRepo.save(
      campaignRepo.create({
        buyerId: buyer.id,
        name: 'Nike Air Max Kampanyası',
        description: 'Spor ve eğlence kitlesi hedefli kampanya',
        totalBudget: 500,
        remaining: 500,
        spentBudget: 0,
        bidPerImpression: 0.003,
        status: CampaignStatus.ACTIVE,
        targeting: {
          contentTags: [
            'action', 'adventure', 'entertainment', 'fun',
            'animation', 'social', 'spor', 'fitness', 'lifestyle',
          ],
        } as any,
      }),
    );
    logger.log(`Seeded Nike demo campaign`);
  }
}
