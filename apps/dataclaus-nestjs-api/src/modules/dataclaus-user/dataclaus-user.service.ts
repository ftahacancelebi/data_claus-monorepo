import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataClausUser } from './entities/dataclaus-user.entity';
import { WalletService } from '../wallet/wallet.service';

export interface UserResponseDto {
  id: string;
  email: string | null;
  displayName: string | null;
  walletId: string | null;
  qualityScore: number;
  totalEarned: number;
  pendingBalance: number;
  createdAt: Date;
}

export interface UserEarningsDto {
  userId: string;
  walletId: string | null;
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  currency: string;
}

@Injectable()
export class DataClausUserService {
  constructor(
    @InjectRepository(DataClausUser)
    private readonly userRepository: Repository<DataClausUser>,
    private readonly walletService: WalletService,
  ) {}

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toResponseDto(user);
  }

  async findByEmail(email: string): Promise<DataClausUser | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async getEarnings(userId: string): Promise<UserEarningsDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let walletBalance = 0;
    let walletPendingBalance = 0;
    let currency = 'USD';

    if (user.walletId) {
      const wallet = await this.walletService.findById(user.walletId);
      walletBalance = wallet.balance;
      walletPendingBalance = wallet.pending_balance;
      currency = wallet.currency;
    }

    return {
      userId: user.id,
      walletId: user.walletId,
      balance: walletBalance,
      pendingBalance: walletPendingBalance,
      totalEarned: Number(user.totalEarned),
      currency,
    };
  }

  async updateTotalEarned(userId: string, amount: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user) {
      user.totalEarned = Number(user.totalEarned) + amount;
      await this.userRepository.save(user);
    }
  }

  private toResponseDto(user: DataClausUser): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      walletId: user.walletId,
      qualityScore: Number(user.qualityScore),
      totalEarned: Number(user.totalEarned),
      pendingBalance: Number(user.pendingBalance),
      createdAt: user.createdAt,
    };
  }
}
