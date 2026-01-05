import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataClausUser } from './entities/dataclaus-user.entity';
import { DataClausUserService } from './dataclaus-user.service';
import { DataClausUserController } from './dataclaus-user.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([DataClausUser]), WalletModule],
  controllers: [DataClausUserController],
  providers: [DataClausUserService],
  exports: [DataClausUserService],
})
export class DataClausUserModule {}
