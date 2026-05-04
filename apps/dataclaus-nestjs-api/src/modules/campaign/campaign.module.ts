import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { CampaignMatcherService } from './campaign-matcher.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, Wallet]), LedgerModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignMatcherService],
  exports: [CampaignService, CampaignMatcherService],
})
export class CampaignModule {}
