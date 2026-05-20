import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from '../wallet/entities';
import { LedgerModule } from '../ledger/ledger.module';
import { Application } from '../application/entities/application.entity';
import { ScoredEvent } from '../ingest/entities/scored-event.entity';
import { DataPackage } from './entities/data-package.entity';
import { PackagePurchase } from './entities/package-purchase.entity';
import { DataPackagesController } from './data-packages.controller';
import { DataPackagesService } from './data-packages.service';
import { PackageEvaluatorService } from './package-evaluator.service';
import { ApplicationExtractorService } from './extractor/application-extractor.service';
import { ExtractorController } from './extractor/extractor.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([DataPackage, PackagePurchase, Wallet, Application, ScoredEvent]),
    LedgerModule,
  ],
  controllers: [DataPackagesController, ExtractorController],
  providers: [DataPackagesService, PackageEvaluatorService, ApplicationExtractorService],
  exports: [DataPackagesService],
})
export class DataPackagesModule {}
