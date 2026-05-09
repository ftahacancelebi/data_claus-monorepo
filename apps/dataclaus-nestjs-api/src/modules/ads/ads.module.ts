import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdImpression } from './entities/ad-impression.entity';
import { Application } from '../application/entities/application.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';
import { AdMediationService } from './ad-mediation.service';

import { WalletModule } from '../wallet/wallet.module';
import { LedgerModule } from '../ledger/ledger.module';
import { CampaignModule } from '../campaign/campaign.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdImpression, Application, Wallet]),
    WalletModule,
    LedgerModule,
    CampaignModule,
  ],
  controllers: [AdsController],
  providers: [AdsService, AdMediationService],
  exports: [AdsService, AdMediationService],
})
export class AdsModule {}
