import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Header,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators';
import { AuditAction } from '../audit/audit.decorator';
import { DsarService } from './dsar.service';

@ApiTags('me / data rights (KVKK / GDPR)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class DsarController {
  constructor(private readonly dsarService: DsarService) {}

  @Get('data-export')
  @AuditAction({ action: 'dsar.export.requested', targetType: 'user' })
  @Header('Content-Type', 'application/json')
  @Header(
    'Content-Disposition',
    'attachment; filename="dataclaus-export.json"',
  )
  @ApiOperation({
    summary:
      'Download a JSON export of all data tied to your account (KVKK Art. 11 / GDPR Art. 15)',
  })
  exportData(@CurrentUser() user: CurrentUserData) {
    return this.dsarService.exportUserData(user.id);
  }

  @Post('account/delete-request')
  @HttpCode(HttpStatus.ACCEPTED)
  @AuditAction({ action: 'dsar.deletion.requested', targetType: 'user' })
  @ApiOperation({
    summary:
      'Request account deletion. 30-day cooling-off period before hard delete.',
  })
  @ApiResponse({ status: 202 })
  requestDeletion(@CurrentUser() user: CurrentUserData) {
    return this.dsarService.requestDeletion(user.id);
  }

  @Delete('account/delete-request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction({ action: 'dsar.deletion.cancelled', targetType: 'user' })
  @ApiOperation({ summary: 'Cancel a pending account deletion' })
  async cancelDeletion(@CurrentUser() user: CurrentUserData) {
    await this.dsarService.cancelDeletion(user.id);
  }
}
