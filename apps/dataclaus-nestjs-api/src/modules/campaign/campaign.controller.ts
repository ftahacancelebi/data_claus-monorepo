import {
  Controller,
  Get,
  Post,
  Patch,
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
import { CampaignService } from './campaign.service';
import {
  CreateCampaignDto,
  UpdateCampaignStatusDto,
  CampaignResponseDto,
} from './dto';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign' })
  @ApiResponse({ status: 201, type: CampaignResponseDto })
  async create(@Body() dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    return this.campaignService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active campaigns' })
  @ApiResponse({ status: 200, type: [CampaignResponseDto] })
  async getActive(): Promise<CampaignResponseDto[]> {
    return this.campaignService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  @ApiResponse({ status: 200, type: CampaignResponseDto })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CampaignResponseDto> {
    return this.campaignService.findById(id);
  }

  @Get('buyer/:buyerId')
  @ApiOperation({ summary: 'Get campaigns by buyer' })
  @ApiResponse({ status: 200, type: [CampaignResponseDto] })
  async getByBuyer(
    @Param('buyerId', ParseUUIDPipe) buyerId: string,
  ): Promise<CampaignResponseDto[]> {
    return this.campaignService.findByBuyer(buyerId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update campaign status' })
  @ApiResponse({ status: 200, type: CampaignResponseDto })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignStatusDto,
  ): Promise<CampaignResponseDto> {
    return this.campaignService.updateStatus(id, dto);
  }
}
