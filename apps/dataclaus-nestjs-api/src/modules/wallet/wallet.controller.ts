import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import {
  WalletReleaseService,
  ReleaseRunResult,
} from './wallet-release.service';
import {
  CreateWalletDto,
  CreditDebitDto,
  WalletResponseDto,
  RevenueSharesResponseDto,
} from './dto';
import { Public, Roles, Role } from '../../common/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller()
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly walletReleaseService: WalletReleaseService,
  ) {}

  @Post('wallets')
  @ApiOperation({ summary: 'Create a new wallet' })
  @ApiResponse({ status: 201, type: WalletResponseDto })
  async create(@Body() dto: CreateWalletDto): Promise<WalletResponseDto> {
    return this.walletService.create(dto);
  }

  @Get('wallets/:id')
  @ApiOperation({ summary: 'Get wallet by ID' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WalletResponseDto> {
    return this.walletService.findById(id);
  }

  @Get('wallets/owner/:ownerId')
  @ApiOperation({ summary: 'Get wallets by owner ID' })
  @ApiResponse({ status: 200, type: [WalletResponseDto] })
  async getByOwner(
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
  ): Promise<WalletResponseDto[]> {
    return this.walletService.findByOwner(ownerId);
  }

  @Post('wallets/:id/credit')
  @ApiOperation({ summary: 'Credit wallet (add to pending balance)' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  async credit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreditDebitDto,
  ): Promise<WalletResponseDto> {
    return this.walletService.credit(id, dto);
  }

  @Post('wallets/:id/debit')
  @ApiOperation({ summary: 'Debit wallet (subtract from balance)' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  @ApiResponse({ status: 400, description: 'Insufficient balance' })
  async debit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreditDebitDto,
  ): Promise<WalletResponseDto> {
    return this.walletService.debit(id, dto);
  }

  @Post('wallets/:id/release-pending')
  @ApiOperation({
    summary:
      'Release pending balance to available balance (writes paired ledger rows)',
  })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  async releasePending(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WalletResponseDto> {
    await this.walletReleaseService.releaseForWalletId(id);
    return this.walletService.findById(id);
  }

  @Post('admin/wallets/release-all-pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Admin: trigger the periodic pending → available release for all eligible wallets',
  })
  async releaseAllPending(): Promise<ReleaseRunResult> {
    return this.walletReleaseService.releaseAllEligible();
  }

  @Get('config/revenue-shares')
  @Public()
  @ApiOperation({ summary: 'Get revenue share configuration' })
  @ApiResponse({ status: 200, type: RevenueSharesResponseDto })
  getRevenueShares(): RevenueSharesResponseDto {
    return this.walletService.getRevenueShares();
  }
}
