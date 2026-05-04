import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookSecret } from './entities/webhook-secret.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { WebhookDispatcher } from './webhook.dispatcher';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookEndpoint,
      WebhookSecret,
      WebhookDelivery,
    ]),
  ],
  providers: [WebhookService, WebhookDispatcher],
  controllers: [WebhookController],
  exports: [WebhookService],
})
export class WebhookModule {}
