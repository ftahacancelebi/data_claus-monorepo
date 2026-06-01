import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WatchEvent } from './entities/watch-event.entity';
import { IngestWatchEventDto } from './dto/ingest-watch-event.dto';
import { VIDEO_METADATA } from './video-metadata';

@Injectable()
export class InternalIngestService {
  constructor(
    @InjectRepository(WatchEvent)
    private readonly repo: Repository<WatchEvent>,
  ) {}

  async ingest(dto: IngestWatchEventDto): Promise<void> {
    const meta = VIDEO_METADATA[dto.videoId] ?? { tags: [], category: 'other' };

    await this.repo.save(
      this.repo.create({
        applicationId: dto.applicationId,
        userId: dto.userId,
        videoId: dto.videoId,
        videoTags: meta.tags,
        videoCategory: meta.category,
        dwellMs: dto.dwellMs,
        completed: dto.completed,
      }),
    );
    // Revenue is earned at the point of real monetization:
    //   - ad impression sealed (slot/seal flow) → user earns 85% of ad revenue
    //   - data package sold → contributors earn proportional share via ContributorDistributionService
    // Watch events alone carry no payout to prevent bot-farming incentives.
  }
}
