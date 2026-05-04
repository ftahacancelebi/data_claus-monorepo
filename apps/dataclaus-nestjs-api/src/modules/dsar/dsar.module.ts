import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DsarService } from './dsar.service';
import { DsarController } from './dsar.controller';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { ScoredEvent } from '../ingest/entities/scored-event.entity';
import { LedgerTransaction } from '../ledger/entities';
import { Wallet } from '../wallet/entities';
import { PayoutRequest } from '../payout/entities/payout-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataClausUser,
      ScoredEvent,
      LedgerTransaction,
      Wallet,
      PayoutRequest,
    ]),
  ],
  providers: [DsarService],
  controllers: [DsarController],
})
export class DsarModule {}
