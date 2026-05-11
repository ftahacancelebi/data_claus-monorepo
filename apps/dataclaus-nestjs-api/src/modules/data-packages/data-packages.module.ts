import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from '../wallet/entities';
import { LedgerModule } from '../ledger/ledger.module';
import { DataPackage } from './entities/data-package.entity';
import { PackagePurchase } from './entities/package-purchase.entity';
import { DataPackagesController } from './data-packages.controller';
import { DataPackagesService } from './data-packages.service';
import { PackageEvaluatorService } from './package-evaluator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataPackage, PackagePurchase, Wallet]),
    LedgerModule,
  ],
  controllers: [DataPackagesController],
  providers: [DataPackagesService, PackageEvaluatorService],
  exports: [DataPackagesService],
})
export class DataPackagesModule {}
