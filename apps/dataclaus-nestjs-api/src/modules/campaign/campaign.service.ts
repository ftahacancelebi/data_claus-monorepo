import { Injectable, NotFoundException } from '@nestjs/common';
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
    const campaign = this.campaignRepository.create({
      buyerId: dto.buyer_id,
      name: dto.name,
      totalBudget: dto.budget,
      remaining: dto.budget,
      status: CampaignStatus.ACTIVE,
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

  private toResponseDto(campaign: Campaign): CampaignResponseDto {
    return {
      id: campaign.id,
      buyer_id: campaign.buyerId,
      name: campaign.name,
      budget: Number(campaign.totalBudget),
      remaining: Number(campaign.remaining),
      status: campaign.status,
      created_at: campaign.createdAt,
      updated_at: campaign.updatedAt,
    };
  }
}
