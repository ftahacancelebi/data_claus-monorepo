import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SigningService } from './signing.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SigningService],
  exports: [SigningService],
})
export class CryptoModule {}
