import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerTransaction } from './entities/ledger-transaction.entity';
import { Wallet } from '../wallet/entities';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { FinancialTxService } from './financial-tx.service';
import { LedgerInvariantService } from './ledger-invariant.service';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerTransaction, Wallet])],
  controllers: [LedgerController],
  providers: [LedgerService, FinancialTxService, LedgerInvariantService],
  exports: [LedgerService, FinancialTxService, LedgerInvariantService],
})
export class LedgerModule {}
