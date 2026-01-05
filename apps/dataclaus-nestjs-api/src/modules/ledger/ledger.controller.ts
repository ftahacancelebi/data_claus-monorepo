import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { LedgerTransactionResponseDto } from './dto';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller()
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('transactions')
  @ApiOperation({ summary: 'Get all transactions' })
  @ApiResponse({ status: 200, type: [LedgerTransactionResponseDto] })
  async getAll(): Promise<LedgerTransactionResponseDto[]> {
    return this.ledgerService.findAll();
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, type: LedgerTransactionResponseDto })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LedgerTransactionResponseDto> {
    return this.ledgerService.findById(id);
  }

  @Get('wallets/:walletId/transactions')
  @ApiOperation({ summary: 'Get transactions by wallet' })
  @ApiResponse({ status: 200, type: [LedgerTransactionResponseDto] })
  async getByWallet(
    @Param('walletId', ParseUUIDPipe) walletId: string,
  ): Promise<LedgerTransactionResponseDto[]> {
    return this.ledgerService.findByWallet(walletId);
  }
}
