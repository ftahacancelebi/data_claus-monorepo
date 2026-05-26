import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdImpression } from './entities/ad-impression.entity';
import { AdCreative } from './entities/ad-creative.entity';
import { Application } from '../application/entities/application.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Campaign } from '../campaign/entities/campaign.entity';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';
import { AdMediationService } from './ad-mediation.service';

import { WalletModule } from '../wallet/wallet.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CampaignModule } from '../campaign/campaign.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdImpression, AdCreative, Application, Wallet, Campaign]),
    WalletModule,
    LedgerModule,
    CampaignModule,
  ],
  controllers: [AdsController],
  providers: [AdsService, AdMediationService],
  exports: [AdsService, AdMediationService],
})
export class AdsModule {}
