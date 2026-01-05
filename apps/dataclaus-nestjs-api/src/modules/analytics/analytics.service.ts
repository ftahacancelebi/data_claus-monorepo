import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Developer } from '../developer/entities';
import { AdImpression } from '../ads/entities';
import { Campaign } from '../campaign/entities';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { CampaignStatus } from '../../common/constants';
import { DashboardStatsDto } from './dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Developer)
    private readonly developerRepo: Repository<Developer>,
    @InjectRepository(AdImpression)
    private readonly adImpressionRepo: Repository<AdImpression>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(DataClausUser)
    private readonly userRepo: Repository<DataClausUser>,
  ) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    // Get total developers count
    const totalDevelopers = await this.developerRepo.count();

    // Get total events (ad impressions) count
    const totalEvents = await this.adImpressionRepo.count();

    // Get total payouts (using grossRevenue as total value tracked)
    const revenueResult = await this.adImpressionRepo
      .createQueryBuilder('impression')
      .select('COALESCE(SUM(impression.grossRevenue), 0)', 'total')
      .getRawOne();
    const totalPayouts = parseFloat(revenueResult?.total || '0');

    // Get active campaigns count
    const activeCampaigns = await this.campaignRepo.count({
      where: { status: CampaignStatus.ACTIVE },
    });

    // Get average quality from users
    const qualityResult = await this.userRepo
      .createQueryBuilder('user')
      .select('COALESCE(AVG(user.qualityScore), 0.5)', 'avg')
      .getRawOne();
    const averageQuality = parseFloat(qualityResult?.avg || '0.5');

    // Total users count
    const totalUsers = await this.userRepo.count();

    return {
      total_events: totalEvents,
      total_users: totalUsers,
      total_developers: totalDevelopers,
      average_quality: averageQuality,
      total_payouts: totalPayouts,
      active_campaigns: activeCampaigns,
    };
  }
}
