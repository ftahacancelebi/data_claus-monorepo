import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';
import {
  LoggingInterceptor,
  TransformInterceptor,
} from './common/interceptors';
import { ensureSystemWallets } from './database/seeds/system-wallet.seed';
import { ensureTikTokApp } from './database/seeds/tiktok-app.seed';
import { ensureDemoBuyer } from './database/seeds/demo-buyer.seed';

async function bootstrap() {
  // bodyParser: false → we register body parsers manually below, AFTER a tiny
  // charset-normalization middleware. body-parser v2 (shipped with Express 5)
  // rejects non-canonical charset values like "utf8" (no dash) with a 415,
  // which broke clients sending `Content-Type: application/json; charset=utf8`.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  // Cookie parsing (req.cookies). Required for the JWT strategy's cookie
  // extractor and for /auth/logout to clear the dc_session cookie.
  app.use(cookieParser());

  // Normalize any `charset=…` parameter on Content-Type to `charset=utf-8`
  // before body-parser inspects it. Must run BEFORE the json/urlencoded
  // parsers we register below.
  app.use((req: any, _res: any, next: any) => {
    const ct = req.headers['content-type'];
    if (typeof ct === 'string' && /charset=/i.test(ct)) {
      req.headers['content-type'] = ct.replace(
        /;\s*charset=[^;]*/gi,
        '; charset=utf-8',
      );
    }
    next();
  });

  // Register body parsers explicitly. The `verify` hook preserves the raw
  // request body on `req.rawBody` so the HMAC webhook guard can recompute
  // the signature — same behavior Nest's `rawBody: true` enables.
  const captureRawBody = (
    req: express.Request & { rawBody?: Buffer },
    _res: express.Response,
    buffer: Buffer,
  ) => {
    if (Buffer.isBuffer(buffer)) req.rawBody = buffer;
  };
  app.use(express.json({ verify: captureRawBody }));
  app.use(express.urlencoded({ extended: true, verify: captureRawBody }));
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('DataClaus API')
    .setDescription('DataClaus Platform API - NestJS Version')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Seed singleton system wallets (idempotent, safe on every boot).
  try {
    const dataSource = app.get(DataSource);
    await ensureSystemWallets(dataSource);
    // Ensure TikTok Clone app exists with the fixed UUID so the money-loop
    // works immediately after `docker compose up`, without running demo:seed.
    await ensureTikTokApp(dataSource);
    await ensureDemoBuyer(dataSource);
  } catch (err) {
    logger.error(
      `Boot seed failed: ${(err as Error).message}`,
      (err as Error).stack,
    );
    // Continue boot — surface the issue but don't block dev environment.
  }

  const port = configService.get<number>('app.port') || 3001;
  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
