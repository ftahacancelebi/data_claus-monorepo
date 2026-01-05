import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import {
  CreateWalletDto,
  CreditDebitDto,
  WalletResponseDto,
  RevenueSharesResponseDto,
} from './dto';
import {
  PLATFORM_FEE_PERCENT,
  DEFAULT_USER_SHARE_PERCENT,
  MIN_USER_SHARE_PERCENT,
  MAX_USER_SHARE_PERCENT,
  MIN_PAYOUT_THRESHOLD,
} from '../../common/constants';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  async create(dto: CreateWalletDto): Promise<WalletResponseDto> {
    const wallet = this.walletRepository.create({
      ownerId: dto.owner_id,
      type: dto.type,
      currency: dto.currency || 'USD',
      balance: 0,
      pendingBalance: 0,
    });

    await this.walletRepository.save(wallet);
    return this.toResponseDto(wallet);
  }

  async findById(id: string): Promise<WalletResponseDto> {
    const wallet = await this.walletRepository.findOne({ where: { id } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return this.toResponseDto(wallet);
  }

  async findByOwner(ownerId: string): Promise<WalletResponseDto[]> {
    const wallets = await this.walletRepository.find({ where: { ownerId } });
    return wallets.map((w) => this.toResponseDto(w));
  }

  async credit(id: string, dto: CreditDebitDto): Promise<WalletResponseDto> {
    const wallet = await this.walletRepository.findOne({ where: { id } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    wallet.pendingBalance = Number(wallet.pendingBalance) + dto.amount;
    await this.walletRepository.save(wallet);
    return this.toResponseDto(wallet);
  }

  async debit(id: string, dto: CreditDebitDto): Promise<WalletResponseDto> {
    const wallet = await this.walletRepository.findOne({ where: { id } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (Number(wallet.balance) < dto.amount) {
      throw new BadRequestException('Insufficient balance');
    }

    wallet.balance = Number(wallet.balance) - dto.amount;
    await this.walletRepository.save(wallet);
    return this.toResponseDto(wallet);
  }

  async releasePending(id: string): Promise<WalletResponseDto> {
    const wallet = await this.walletRepository.findOne({ where: { id } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const released = wallet.releasePending();
    if (released > 0) {
      await this.walletRepository.save(wallet);
    }

    return this.toResponseDto(wallet);
  }

  getRevenueShares(): RevenueSharesResponseDto {
    return {
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      user_share_percent: DEFAULT_USER_SHARE_PERCENT,
      developer_share_percent:
        100 - PLATFORM_FEE_PERCENT - DEFAULT_USER_SHARE_PERCENT,
      min_payout_threshold: MIN_PAYOUT_THRESHOLD,
    };
  }

  private toResponseDto(wallet: Wallet): WalletResponseDto {
    return {
      id: wallet.id,
      owner_id: wallet.ownerId,
      type: wallet.type,
      balance: Number(wallet.balance),
      pending_balance: Number(wallet.pendingBalance),
      currency: wallet.currency,
      created_at: wallet.createdAt,
      updated_at: wallet.updatedAt,
    };
  }
}
