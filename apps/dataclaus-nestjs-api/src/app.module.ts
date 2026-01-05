import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

// Config
import { databaseConfig, jwtConfig, appConfig } from './config';

// App Controller
import { AppController } from './app.controller';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { DeveloperModule } from './modules/developer/developer.module';
import { ApplicationModule } from './modules/application/application.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { AdsModule } from './modules/ads/ads.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DataClausUserModule } from './modules/dataclaus-user/dataclaus-user.module';
import { AdminModule } from './modules/admin/admin.module';

// Entities
import { Developer, ApiKey } from './modules/developer/entities';
import { Application } from './modules/application/entities';
import { Wallet } from './modules/wallet/entities';
import { Campaign } from './modules/campaign/entities';
import { LedgerTransaction } from './modules/ledger/entities';
import { AdImpression } from './modules/ads/entities';
import { DataClausUser } from './modules/dataclaus-user/entities/dataclaus-user.entity';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, appConfig],
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [
          Developer,
          ApiKey,
          Application,
          Wallet,
          Campaign,
          LedgerTransaction,
          AdImpression,
          DataClausUser,
        ],
        synchronize: configService.get<boolean>('database.synchronize'),
        logging: configService.get<boolean>('database.logging'),
      }),
      inject: [ConfigService],
    }),

    // Feature Modules
    AuthModule,
    DeveloperModule,
    ApplicationModule,
    WalletModule,
    CampaignModule,
    LedgerModule,
    AdsModule,
    AnalyticsModule,
    DataClausUserModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    // Global JWT Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Roles Guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
