import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Application } from '../application/entities/application.entity';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeBridge } from './realtime.bridge';

@Module({
  imports: [
    TypeOrmModule.forFeature([Application]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
  ],
  providers: [RealtimeGateway, RealtimeBridge],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
