import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletReleaseService } from './wallet-release.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet]), LedgerModule],
  controllers: [WalletController],
  providers: [WalletService, WalletReleaseService],
  exports: [WalletService, WalletReleaseService],
})
export class WalletModule {}
