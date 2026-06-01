import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './entities/application.entity';
import { Developer } from '../developer/entities/developer.entity';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ToggleStatusDto,
  ApplicationResponseDto,
  ApplicationStatsDto,
} from './dto';

@Injectable()
export class ApplicationService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    @InjectRepository(Developer)
    private readonly developerRepository: Repository<Developer>,
  ) {}

  async create(
    developerId: string,
    dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const developerExists = await this.developerRepository.existsBy({ id: developerId });
    if (!developerExists) {
      throw new NotFoundException(`Developer ${developerId} not found`);
    }

    const application = this.applicationRepository.create({
      developerId,
      name: dto.name,
      description: dto.description || '',
      category: dto.category || '',
      websiteUrl: dto.website_url || '',
      userSharePercent: dto.user_share_percent || 0,
      isActive: true,
    });

    await this.applicationRepository.save(application);
    return this.toResponseDto(application);
  }

  async findById(id: string): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return this.toResponseDto(application);
  }

  async findByDeveloper(
    developerId: string,
  ): Promise<ApplicationResponseDto[]> {
    const developerExists = await this.developerRepository.existsBy({ id: developerId });
    if (!developerExists) {
      throw new NotFoundException(`Developer ${developerId} not found`);
    }

    const applications = await this.applicationRepository.find({
      where: { developerId },
      order: { createdAt: 'DESC' },
    });

    return applications.map((app) => this.toResponseDto(app));
  }

  async update(
    id: string,
    dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Map snake_case DTO to camelCase entity
    if (dto.name !== undefined) application.name = dto.name;
    if (dto.description !== undefined)
      application.description = dto.description;
    if (dto.category !== undefined) application.category = dto.category;
    if (dto.website_url !== undefined) application.websiteUrl = dto.website_url;
    if (dto.user_share_percent !== undefined)
      application.userSharePercent = dto.user_share_percent;

    await this.applicationRepository.save(application);

    return this.toResponseDto(application);
  }

  async toggleStatus(
    id: string,
    dto: ToggleStatusDto,
  ): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    application.isActive = dto.is_active;
    await this.applicationRepository.save(application);

    return this.toResponseDto(application);
  }

  async delete(id: string): Promise<void> {
    const result = await this.applicationRepository.delete({ id });

    if (result.affected === 0) {
      throw new NotFoundException('Application not found');
    }
  }

  async getStats(id: string): Promise<ApplicationStatsDto> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // In a real implementation, these would be calculated from event data
    return {
      application_id: application.id,
      total_events: Number(application.totalEvents),
      total_users: Number(application.totalUsers),
      total_revenue: Number(application.totalRevenue),
      avg_quality: Number(application.qualityScore),
      events_today: 0, // Would calculate from events
      events_week: 0,
      events_month: 0,
    };
  }

  private toResponseDto(application: Application): ApplicationResponseDto {
    return {
      id: application.id,
      developer_id: application.developerId,
      name: application.name,
      description: application.description || undefined,
      category: application.category || undefined,
      website_url: application.websiteUrl || undefined,
      is_active: application.isActive,
      total_events: Number(application.totalEvents),
      total_users: Number(application.totalUsers),
      total_revenue: Number(application.totalRevenue),
      quality_score: Number(application.qualityScore),
      last_event_at: application.lastEventAt || undefined,
      user_share_percent: application.userSharePercent,
      created_at: application.createdAt,
      updated_at: application.updatedAt,
    };
  }
}
