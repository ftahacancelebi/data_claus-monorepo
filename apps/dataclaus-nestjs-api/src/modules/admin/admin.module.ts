import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { Developer } from '../developer/entities/developer.entity';
import { Application } from '../application/entities/application.entity';
import { AdImpression } from '../ads/entities/ad-impression.entity';
import { LedgerTransaction } from '../ledger/entities/ledger-transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataClausUser,
      Developer,
      Application,
      AdImpression,
      LedgerTransaction,
      Wallet,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
