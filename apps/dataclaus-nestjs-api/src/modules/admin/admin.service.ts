import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { Developer } from '../developer/entities/developer.entity';
import { Application } from '../application/entities/application.entity';
import { AdImpression } from '../ads/entities/ad-impression.entity';
import { LedgerTransaction } from '../ledger/entities/ledger-transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';

export interface PlatformStatsDto {
  totalUsers: number;
  totalDevelopers: number;
  totalApplications: number;
  totalImpressions: number;
  totalRevenue: number;
  platformFees: number;
  totalTransactions: number;
}

export interface AdminUserDto {
  id: string;
  email: string;
  displayName: string | null;
  walletId: string | null;
  qualityScore: number;
  totalEarned: number;
  pendingBalance: number;
  createdAt: Date;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(DataClausUser)
    private readonly userRepository: Repository<DataClausUser>,
    @InjectRepository(Developer)
    private readonly developerRepository: Repository<Developer>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(AdImpression)
    private readonly impressionRepository: Repository<AdImpression>,
    @InjectRepository(LedgerTransaction)
    private readonly ledgerRepository: Repository<LedgerTransaction>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  async getPlatformStats(): Promise<PlatformStatsDto> {
    const [totalUsers, totalDevelopers, totalApplications, totalTransactions] =
      await Promise.all([
        this.userRepository.count(),
        this.developerRepository.count(),
        this.applicationRepository.count(),
        this.ledgerRepository.count(),
      ]);

    // Calculate revenue stats from impressions
    const impressionStats = await this.impressionRepository
      .createQueryBuilder('impression')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(impression.grossRevenue), 0)', 'totalRevenue')
      .addSelect('COALESCE(SUM(impression.platformFee), 0)', 'platformFees')
      .getRawOne();

    return {
      totalUsers,
      totalDevelopers,
      totalApplications,
      totalImpressions: parseInt(impressionStats?.count || '0', 10),
      totalRevenue: parseFloat(impressionStats?.totalRevenue || '0'),
      platformFees: parseFloat(impressionStats?.platformFees || '0'),
      totalTransactions,
    };
  }

  async getAllUsers(): Promise<AdminUserDto[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      walletId: user.walletId,
      qualityScore: Number(user.qualityScore),
      totalEarned: Number(user.totalEarned),
      pendingBalance: Number(user.pendingBalance),
      createdAt: user.createdAt,
    }));
  }

  async getUserById(id: string): Promise<AdminUserDto | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) return null;

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
