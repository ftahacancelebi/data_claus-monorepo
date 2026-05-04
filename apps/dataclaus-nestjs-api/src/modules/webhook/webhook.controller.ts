import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, Role, CurrentUser, CurrentUserData } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditAction } from '../audit/audit.decorator';
import { WebhookService } from './webhook.service';
import {
  CreateEndpointDto,
  UpdateEndpointDto,
  CreateSecretDto,
  TestEventDto,
  WEBHOOK_EVENT_TYPES,
} from './dto/webhook.dto';

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DEVELOPER, Role.ADMIN)
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get('event-types')
  @ApiOperation({ summary: 'List supported webhook event types' })
  listEventTypes() {
    return { eventTypes: WEBHOOK_EVENT_TYPES };
  }

  @Get('endpoints')
  @ApiOperation({ summary: 'List webhook endpoints owned by the developer' })
  listEndpoints(@CurrentUser() user: CurrentUserData) {
    return this.webhookService.listEndpoints(user.id);
  }

  @Post('endpoints')
  @ApiOperation({ summary: 'Register a new webhook endpoint' })
  @ApiResponse({ status: 201 })
  createEndpoint(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateEndpointDto,
  ) {
    return this.webhookService.createEndpoint(user.id, dto);
  }

  @Patch('endpoints/:id')
  @ApiOperation({ summary: 'Update a webhook endpoint' })
  updateEndpoint(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateEndpointDto,
  ) {
    return this.webhookService.updateEndpoint(user.id, id, dto);
  }

  @Delete('endpoints/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  async deleteEndpoint(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    await this.webhookService.deleteEndpoint(user.id, id);
  }

  // -------------------------------------------------------------------------
  // Secrets
  // -------------------------------------------------------------------------

  @Post('endpoints/:id/secrets')
  @AuditAction({
    action: 'webhook.secret.created',
    targetType: 'webhook_endpoint',
    targetIdParam: 'id',
  })
  @ApiOperation({
    summary:
      'Generate a new signing secret for an endpoint. Cleartext is returned ONCE.',
  })
  createSecret(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: CreateSecretDto,
  ) {
    return this.webhookService.createSecret(user.id, id, dto);
  }

  @Get('endpoints/:id/secrets')
  @ApiOperation({ summary: 'List secrets for an endpoint (no cleartext)' })
  listSecrets(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ) {
    return this.webhookService.listSecrets(user.id, id);
  }

  @Delete('endpoints/:id/secrets/:secretId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction({
    action: 'webhook.secret.revoked',
    targetType: 'webhook_secret',
    targetIdParam: 'secretId',
  })
  @ApiOperation({ summary: 'Revoke a webhook signing secret' })
  async revokeSecret(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Param('secretId') secretId: string,
  ) {
    await this.webhookService.revokeSecret(user.id, id, secretId);
  }

  // -------------------------------------------------------------------------
  // Deliveries
  // -------------------------------------------------------------------------

  @Get('endpoints/:id/deliveries')
  @ApiOperation({ summary: 'Recent delivery attempts for an endpoint' })
  listDeliveries(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 50;
    return this.webhookService.listDeliveries(
      user.id,
      id,
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  @Post('endpoints/:id/test')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Enqueue a test delivery to the endpoint with the given event',
  })
  async testEndpoint(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: TestEventDto,
  ) {
    const ep = await this.webhookService.getEndpoint(user.id, id);
    const deliveries = await this.webhookService.enqueueDelivery({
      eventType: dto.eventType,
      payload: dto.payload ?? { test: true, endpointId: ep.id },
      developerId: user.id,
    });
    return {
      enqueued: deliveries.length,
      deliveryIds: deliveries.map((d) => d.id),
    };
  }
}
