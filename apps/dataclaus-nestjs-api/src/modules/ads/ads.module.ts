import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdImpression } from './entities/ad-impression.entity';
import { Application } from '../application/entities/application.entity';
import { AdsService } from './ads.service';
import { AdsController } from './ads.controller';

import { WalletModule } from '../wallet/wallet.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdImpression, Application]),
    WalletModule,
    LedgerModule,
  ],
  controllers: [AdsController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
