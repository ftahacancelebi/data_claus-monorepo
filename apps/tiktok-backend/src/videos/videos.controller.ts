/**
 * Videos Controller
 *
 * API endpoints for video content.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { VideosService, FeedItem, Video } from './videos.service';
import { DataClausService } from '../dataclaus/dataclaus.service';

class RecordViewDto {
  duration!: number;
  completed!: boolean;
}

@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly dataClausService: DataClausService,
  ) {}

  /**
   * Get video feed with ad slots.
   * Returns paginated list of videos with ads inserted.
   */
  @Get('feed')
  async getFeed(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Headers('authorization') authHeader?: string,
  ): Promise<{
    items: FeedItem[];
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    let userId: string | undefined;

    // Try to get user ID from token for personalization
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const user = await this.dataClausService.getUserProfile(token);
        userId = user?.id;
      } catch {
        // Token invalid, continue without user context
      }
    }

    return this.videosService.getFeed(page, limit, userId);
  }

  /**
   * Get a single video by ID.
   */
  @Get(':id')
  getVideo(@Param('id') id: string): Video {
    return this.videosService.getVideo(id);
  }

  /**
   * Like/unlike a video.
   * Requires authentication.
   */
  @Post(':id/like')
  async likeVideo(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ): Promise<{ success: boolean; isLiked: boolean; likesCount: number }> {
    const token = authHeader?.replace('Bearer ', '');
    const user = await this.dataClausService.getUserProfile(token);

    if (!user) {
      return { success: false, isLiked: false, likesCount: 0 };
    }

    const result = this.videosService.toggleLike(id, user.id);
    return { success: true, ...result };
  }

  /**
   * Record a video view.
   * Tracks view duration and completion for analytics.
   */
  @Post(':id/view')
  async recordView(
    @Param('id') id: string,
    @Body() dto: RecordViewDto,
    @Headers('authorization') authHeader?: string,
  ): Promise<{ success: boolean; isNewView: boolean }> {
    let userId = 'anonymous';

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const user = await this.dataClausService.getUserProfile(token);
        if (user) {
          userId = user.id;
        }
      } catch {
        // Continue with anonymous
      }
    }

    const result = this.videosService.recordView(
      id,
      userId,
      dto.duration,
      dto.completed,
    );
    return { success: true, isNewView: result.isNewView };
  }
}
