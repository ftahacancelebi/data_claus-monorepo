import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PayoutService } from './payout.service';
import {
  RequestPayoutDto,
  PayoutResponseDto,
  AdminRejectPayoutDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role, CurrentUser } from '../../common/decorators';
import type { CurrentUserData } from '../../common/decorators/current-user.decorator';
import { AuditAction } from '../audit/audit.decorator';

@ApiTags('Payouts')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Post('payouts/request')
  @AuditAction({ action: 'payout.requested', targetType: 'payout' })
  @ApiOperation({ summary: 'Request a withdrawal from the user wallet' })
  async requestPayout(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RequestPayoutDto,
  ): Promise<PayoutResponseDto> {
    return this.payoutService.requestPayout(user.id, dto);
  }

  @Get('payouts/me')
  @ApiOperation({ summary: 'List the current user payout requests' })
  async listMine(
    @CurrentUser() user: CurrentUserData,
  ): Promise<PayoutResponseDto[]> {
    return this.payoutService.listMine(user.id);
  }

  @Get('payouts/:id')
  @ApiOperation({ summary: 'Get a single payout request' })
  async getOne(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PayoutResponseDto> {
    return this.payoutService.getOne(id, user.id);
  }

  @Get('admin/payouts')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: list all payout requests' })
  async adminListAll(): Promise<PayoutResponseDto[]> {
    return this.payoutService.listAll();
  }

  @Post('admin/payouts/:id/approve')
  @Roles(Role.ADMIN)
  @AuditAction({
    action: 'payout.admin.approved',
    targetType: 'payout',
    targetIdParam: 'id',
  })
  @ApiOperation({
    summary: 'Admin: approve & dispatch a payout via the simulated provider',
  })
  async adminApprove(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PayoutResponseDto> {
    return this.payoutService.adminApprove(id, user.id);
  }

  @Post('admin/payouts/:id/reject')
  @Roles(Role.ADMIN)
  @AuditAction({
    action: 'payout.admin.rejected',
    targetType: 'payout',
    targetIdParam: 'id',
  })
  @ApiOperation({ summary: 'Admin: reject a payout and release the hold' })
  async adminReject(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminRejectPayoutDto,
  ): Promise<PayoutResponseDto> {
    return this.payoutService.adminReject(id, user.id, dto);
  }
}
