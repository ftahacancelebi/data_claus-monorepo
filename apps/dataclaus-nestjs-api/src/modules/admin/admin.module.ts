import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminHealthController } from './admin-health.controller';
import { AdminHealthService } from './admin-health.service';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { Developer } from '../developer/entities/developer.entity';
import { Application } from '../application/entities/application.entity';
import { AdImpression } from '../ads/entities/ad-impression.entity';
import { LedgerTransaction } from '../ledger/entities/ledger-transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { LedgerModule } from '../ledger/ledger.module';
import { RealtimeModule } from '../realtime/realtime.module';

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
    LedgerModule,
    RealtimeModule,
  ],
  controllers: [AdminController, AdminHealthController],
  providers: [AdminService, AdminHealthService],
  exports: [AdminService, AdminHealthService],
})
export class AdminModule {}
