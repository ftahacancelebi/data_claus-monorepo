import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../application/entities';
import { ApiKey } from '../developer/entities';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { LedgerModule } from '../ledger/ledger.module';
import { ScoredEvent } from './entities/scored-event.entity';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { IngestValidatorService } from './ingest-validator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScoredEvent,
      Application,
      ApiKey,
      DataClausUser,
    ]),
    LedgerModule,
  ],
  controllers: [IngestController],
  providers: [IngestService, IngestValidatorService],
  exports: [IngestService],
})
export class IngestModule {}
