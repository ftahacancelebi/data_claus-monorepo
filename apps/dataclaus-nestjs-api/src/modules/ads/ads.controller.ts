import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdsService } from './ads.service';
import { AdMediationService } from './ad-mediation.service';
import {
  RecordImpressionDto,
  AdRatesResponseDto,
  AdRevenueSummaryDto,
  AdConfigResponseDto,
  ImpressionResponseDto,
  RequestAdSlotDto,
  SignedAdSlotDto,
  SealImpressionDto,
  ServeAdResponseDto,
} from './dto';
import { Public, Roles, Role } from '../../common/decorators';

@ApiTags('ads')
@ApiBearerAuth()
@Controller()
export class AdsController {
  constructor(
    private readonly adsService: AdsService,
    private readonly mediation: AdMediationService,
  ) {}

  @Get('ads/rates')
  @Public()
  @ApiOperation({ summary: 'Get current ad rates (eCPM)' })
  @ApiResponse({ status: 200, type: AdRatesResponseDto })
  getAdRates(): AdRatesResponseDto {
    return this.adsService.getAdRates();
  }

  @Get('ads/serve')
  @Public()
  @ApiOperation({ summary: 'Serve a feed ad matched against content tags' })
  @ApiResponse({ status: 200, type: ServeAdResponseDto })
  async serveAd(
    @Query('tags') tags?: string,
  ): Promise<ServeAdResponseDto | null> {
    const tagList = tags
      ? tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];
    return this.adsService.serveAd(tagList);
  }

  /**
   * SDK FLOW STEP 1.
   *
   * The SDK calls this BEFORE rendering an ad. The server resolves the
   * ad-unit ID (so it never lives in client config), runs eligibility checks,
   * and returns a short-lived signed slot token. The SDK then asks the
   * platform ad SDK (AdMob etc.) to render `ad_unit_id`. When the impression
   * fires, the SDK calls `/seal` with the slot token.
   */
  @Post('applications/:appId/ads/slot')
  @ApiOperation({ summary: 'Request a signed ad slot' })
  @ApiResponse({ status: 201, type: SignedAdSlotDto })
  async requestAdSlot(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Body() dto: RequestAdSlotDto,
  ): Promise<SignedAdSlotDto> {
    return this.mediation.requestSlot(appId, dto);
  }

  /**
   * SDK FLOW STEP 2.
   *
   * The SDK calls this AFTER the platform ad SDK confirms the impression
   * fired. The slot token is verified (signature, expiry, replay) and the
   * ledger is updated atomically. Client-reported revenue is treated as a
   * cross-check signal only — see `AdMediationService.reconcileRevenue`.
   */
  @Post('applications/:appId/ads/seal')
  @ApiOperation({ summary: 'Seal an impression against a slot token' })
  @ApiResponse({ status: 201, type: ImpressionResponseDto })
  async sealImpression(
    @Param('appId', ParseUUIDPipe) appId: string,
    @Body() dto: SealImpressionDto,
  ): Promise<ImpressionResponseDto> {
    return this.adsService.sealImpression(appId, dto);
  }

  /**
   * @deprecated Public clients must use the slot/seal flow above. This route
   * is restricted to admins for tooling/backfill scenarios. Trusts
   * `gross_revenue` from the caller — never expose to untrusted clients.
   */
  @Post('applications/:appId/ads/impression')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Record an ad impression (admin/backfill only — DEPRECATED)',
    deprecated: true,
  })
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

  // ─── Ad Creative endpoints ─────────────────────────────────────────────────

  @Get('ad-creatives/active')
  @Public()
  @ApiOperation({ summary: 'Get currently active ad creative (public)' })
  async getActiveCreative() {
    return this.adsService.getActiveCreative();
  }

  @Post('ad-creatives')
  @ApiOperation({ summary: 'Submit an ad creative (buyer)' })
  async createCreative(
    @Body() body: { brandName: string; imageUrl: string; ctaText?: string },
    @Request() req: { user?: { id: string } },
  ) {
    return this.adsService.createCreative({
      ...body,
      buyerId: req.user?.id,
    });
  }

  @Get('ad-creatives/mine')
  @ApiOperation({ summary: 'List my submitted ad creatives (buyer)' })
  async getMyCreatives(@Request() req: { user?: { id: string } }) {
    if (!req.user?.id) return [];
    return this.adsService.getCreativesByBuyer(req.user.id);
  }

  @Patch('ad-creatives/:id/activate')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activate an ad creative (admin)' })
  async activateCreative(@Param('id', ParseUUIDPipe) id: string) {
    return this.adsService.activateCreative(id);
  }
}
