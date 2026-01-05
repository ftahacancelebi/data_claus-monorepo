import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import {
  CreateWalletDto,
  CreditDebitDto,
  WalletResponseDto,
  RevenueSharesResponseDto,
} from './dto';
import { Public } from '../../common/decorators';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

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
  @ApiOperation({ summary: 'Release pending balance to available balance' })
  @ApiResponse({ status: 200, type: WalletResponseDto })
  async releasePending(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WalletResponseDto> {
    return this.walletService.releasePending(id);
  }

  @Get('config/revenue-shares')
  @Public()
  @ApiOperation({ summary: 'Get revenue share configuration' })
  @ApiResponse({ status: 200, type: RevenueSharesResponseDto })
  getRevenueShares(): RevenueSharesResponseDto {
    return this.walletService.getRevenueShares();
  }
}
