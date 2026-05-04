import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PayoutRequest } from './entities/payout-request.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { PayoutService } from './payout.service';
import { PayoutController } from './payout.controller';
import { StripeSimulationProvider } from './providers/stripe-simulation.provider';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayoutRequest, Wallet]),
    ConfigModule,
    LedgerModule,
  ],
  controllers: [PayoutController],
  providers: [PayoutService, StripeSimulationProvider],
  exports: [PayoutService],
})
export class PayoutModule {}
