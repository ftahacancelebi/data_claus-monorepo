import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataClausUser } from './entities/dataclaus-user.entity';
import { UserProfile } from './entities/user-profile.entity';
import { DataClausUserService } from './dataclaus-user.service';
import { DataClausUserController } from './dataclaus-user.controller';
import { MeService } from './me.service';
import { MeController } from './me.controller';
import { AdImpression } from '../ads/entities/ad-impression.entity';
import { Application } from '../application/entities/application.entity';
import { LedgerTransaction } from '../ledger/entities/ledger-transaction.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataClausUser,
      UserProfile,
      AdImpression,
      Application,
      LedgerTransaction,
      AuditLog,
      Wallet,
    ]),
    WalletModule,
  ],
  controllers: [DataClausUserController, MeController],
  providers: [DataClausUserService, MeService],
  exports: [DataClausUserService],
})
export class DataClausUserModule {}
