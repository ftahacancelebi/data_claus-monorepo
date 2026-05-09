import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';
import {
  LoggingInterceptor,
  TransformInterceptor,
} from './common/interceptors';
import { ensureSystemWallets } from './database/seeds/system-wallet.seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Cookie parsing (req.cookies). Required for the JWT strategy's cookie
  // extractor and for /auth/logout to clear the dc_session cookie.
  app.use(cookieParser());
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
  } catch (err) {
    logger.error(
      `System wallet seed failed: ${(err as Error).message}`,
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
