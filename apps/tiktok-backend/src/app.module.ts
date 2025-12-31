import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { VideosModule } from './videos/videos.module';
import { EarningsModule } from './earnings/earnings.module';
import { DataClausModule } from './dataclaus/dataclaus.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DataClausModule,
    AuthModule,
    VideosModule,
    EarningsModule,
  ],
})
export class AppModule {}
