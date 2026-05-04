import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import {
  CreateCampaignDto,
  UpdateCampaignStatusDto,
  CampaignResponseDto,
} from './dto';
import { CampaignStatus } from '../../common/constants';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
  ) {}

  async create(dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    const bid =
      typeof dto.bid_per_impression === 'number' && dto.bid_per_impression > 0
        ? dto.bid_per_impression
        : 0;

    if (bid > 0 && bid > dto.budget) {
      throw new BadRequestException(
        'bid_per_impression cannot exceed total budget',
      );
    }

    const campaign = this.campaignRepository.create({
      buyerId: dto.buyer_id,
      name: dto.name,
      description: dto.description ?? null,
      totalBudget: dto.budget,
      remaining: dto.budget,
      spentBudget: 0,
      bidPerImpression: bid,
      targeting: dto.targeting ?? {},
      startsAt: dto.starts_at ? new Date(dto.starts_at) : null,
      endsAt: dto.ends_at ? new Date(dto.ends_at) : null,
      status: CampaignStatus.ACTIVE,
      impressionsServed: 0,
      uniqueUsersReached: 0,
    });

    await this.campaignRepository.save(campaign);
    return this.toResponseDto(campaign);
  }

  async findById(id: string): Promise<CampaignResponseDto> {
    const campaign = await this.campaignRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return this.toResponseDto(campaign);
  }

  async findActive(): Promise<CampaignResponseDto[]> {
    const campaigns = await this.campaignRepository.find({
      where: { status: CampaignStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
    return campaigns.map((c) => this.toResponseDto(c));
  }

  async findByBuyer(buyerId: string): Promise<CampaignResponseDto[]> {
    const campaigns = await this.campaignRepository.find({
      where: { buyerId },
      order: { createdAt: 'DESC' },
    });
    return campaigns.map((c) => this.toResponseDto(c));
  }

  async updateStatus(
    id: string,
    dto: UpdateCampaignStatusDto,
  ): Promise<CampaignResponseDto> {
    const campaign = await this.campaignRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    campaign.status = dto.status;
    await this.campaignRepository.save(campaign);
    return this.toResponseDto(campaign);
  }

  async pause(id: string): Promise<CampaignResponseDto> {
    return this.updateStatus(id, { status: CampaignStatus.PAUSED });
  }

  async resume(id: string): Promise<CampaignResponseDto> {
    return this.updateStatus(id, { status: CampaignStatus.ACTIVE });
  }

  async approve(id: string): Promise<CampaignResponseDto> {
    return this.updateStatus(id, { status: CampaignStatus.ACTIVE });
  }

  private toResponseDto(campaign: Campaign): CampaignResponseDto {
    return {
      id: campaign.id,
      buyer_id: campaign.buyerId,
      name: campaign.name,
      description: campaign.description ?? null,
      budget: Number(campaign.totalBudget),
      total_budget: Number(campaign.totalBudget),
      remaining: Number(campaign.remaining),
      spent_budget: Number(campaign.spentBudget ?? 0),
      bid_per_impression: Number(campaign.bidPerImpression ?? 0),
      targeting: campaign.targeting ?? {},
      status: campaign.status,
      starts_at: campaign.startsAt,
      ends_at: campaign.endsAt,
      impressions_served: Number(campaign.impressionsServed ?? 0),
      unique_users_reached: Number(campaign.uniqueUsersReached ?? 0),
      created_at: campaign.createdAt,
      updated_at: campaign.updatedAt,
    };
  }
}
