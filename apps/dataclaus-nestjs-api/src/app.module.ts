import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

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
import { IngestModule } from './modules/ingest/ingest.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { PayoutModule } from './modules/payout/payout.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { DsarModule } from './modules/dsar/dsar.module';

// Entities
import { Developer, ApiKey } from './modules/developer/entities';
import { Application } from './modules/application/entities';
import { Wallet } from './modules/wallet/entities';
import { Campaign } from './modules/campaign/entities';
import { LedgerTransaction } from './modules/ledger/entities';
import { AdImpression } from './modules/ads/entities';
import { DataClausUser } from './modules/dataclaus-user/entities/dataclaus-user.entity';
import { ScoredEvent } from './modules/ingest/entities/scored-event.entity';
import { PayoutRequest } from './modules/payout/entities/payout-request.entity';
import { OtpRequest } from './modules/auth/entities';
import {
  WebhookEndpoint,
  WebhookSecret,
  WebhookDelivery,
} from './modules/webhook/entities';
import { AuditLog } from './modules/audit/entities/audit-log.entity';

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
          ScoredEvent,
          PayoutRequest,
          OtpRequest,
          WebhookEndpoint,
          WebhookSecret,
          WebhookDelivery,
          AuditLog,
        ],
        synchronize: configService.get<boolean>('database.synchronize'),
        logging: configService.get<boolean>('database.logging'),
      }),
      inject: [ConfigService],
    }),

    // Global in-process event bus (Phase 1 → Phase 4 bridge)
    EventEmitterModule.forRoot({
      wildcard: false,
      maxListeners: 50,
      verboseMemoryLeak: false,
    }),

    // Cron scheduler (Phase 2: ledger invariant + pending balance release)
    ScheduleModule.forRoot(),

    // Rate limiting (Phase 3 — Auth & Security)
    // Two named tiers; per-route throttles can override via @Throttle decorator.
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 }, // 10 req/sec anti-burst
      { name: 'medium', ttl: 60_000, limit: 100 }, // 100 req/min default
    ]),

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
    IngestModule,
    RealtimeModule,
    PayoutModule,
    WebhookModule,
    AuditModule,
    DsarModule,
  ],
  controllers: [AppController],
  providers: [
    // Global rate limiter — runs first so abusive callers never reach JWT.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
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
    // Global Audit Interceptor (records @AuditAction-decorated handlers)
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
