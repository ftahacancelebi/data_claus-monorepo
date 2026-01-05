import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdsService } from './ads.service';
import {
  RecordImpressionDto,
  AdRatesResponseDto,
  AdRevenueSummaryDto,
  AdConfigResponseDto,
  ImpressionResponseDto,
} from './dto';
import { Public } from '../../common/decorators';

@ApiTags('ads')
@ApiBearerAuth()
@Controller()
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get('ads/rates')
  @Public()
  @ApiOperation({ summary: 'Get current ad rates (eCPM)' })
  @ApiResponse({ status: 200, type: AdRatesResponseDto })
  getAdRates(): AdRatesResponseDto {
    return this.adsService.getAdRates();
  }

  @Post('applications/:appId/ads/impression')
  @ApiOperation({ summary: 'Record an ad impression' })
  @ApiResponse({ status: 201, type: ImpressionResponseDto })
  async recordImpression(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Body() dto: RecordImpressionDto,
  ): Promise<ImpressionResponseDto> {
    return this.adsService.recordImpression(appId, dto);
  }

  @Get('applications/:appId/ads/config')
  @ApiOperation({ summary: 'Get ad configuration for application' })
  @ApiResponse({ status: 200, type: AdConfigResponseDto })
  async getAdConfig(
    @Param('appId', ParseUUIDPipe) appId: string,
  ): Promise<AdConfigResponseDto> {
    return this.adsService.getAdConfig(appId);
  }

  @Get('applications/:appId/ads/summary')
  @ApiOperation({ summary: 'Get application revenue summary' })
  @ApiResponse({ status: 200, type: AdRevenueSummaryDto })
  async getApplicationSummary(
    @Param('appId', ParseUUIDPipe) appId: string,
  ): Promise<AdRevenueSummaryDto> {
    return this.adsService.getApplicationRevenueSummary(appId);
  }

  @Get('users/:userId/ads/summary')
  @ApiOperation({ summary: 'Get user revenue summary' })
  @ApiResponse({ status: 200, type: AdRevenueSummaryDto })
  async getUserSummary(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<AdRevenueSummaryDto> {
    return this.adsService.getUserRevenueSummary(userId);
  }

  @Get('developers/:developerId/ads/summary')
  @ApiOperation({ summary: 'Get developer revenue summary' })
  @ApiResponse({ status: 200, type: AdRevenueSummaryDto })
  async getDeveloperSummary(
    @Param('developerId', ParseUUIDPipe) developerId: string,
  ): Promise<AdRevenueSummaryDto> {
    return this.adsService.getDeveloperRevenueSummary(developerId);
  }

  @Post('applications/:appId/sync-stats')
  @Public()
  @ApiOperation({ summary: 'Sync application stats from impressions' })
  @ApiResponse({ status: 200 })
  async syncApplicationStats(
    @Param('appId', ParseUUIDPipe) appId: string,
  ): Promise<{
    total_events: number;
    total_users: number;
    total_revenue: number;
    synced: boolean;
  }> {
    return this.adsService.syncApplicationStats(appId);
  }
}
