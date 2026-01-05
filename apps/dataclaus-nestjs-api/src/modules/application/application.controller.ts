import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { ApplicationService } from './application.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ToggleStatusDto,
  ApplicationResponseDto,
  ApplicationStatsDto,
} from './dto';

@ApiTags('applications')
@ApiBearerAuth()
@Controller()
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post('developers/:developerId/applications')
  @ApiOperation({ summary: 'Create a new application for a developer' })
  @ApiResponse({ status: 201, type: ApplicationResponseDto })
  async create(
    @Param('developerId', ParseUUIDPipe) developerId: string,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationService.create(developerId, dto);
  }

  @Get('developers/:developerId/applications')
  @ApiOperation({ summary: 'Get all applications for a developer' })
  @ApiResponse({ status: 200, type: [ApplicationResponseDto] })
  async getByDeveloper(
    @Param('developerId', ParseUUIDPipe) developerId: string,
  ): Promise<ApplicationResponseDto[]> {
    return this.applicationService.findByDeveloper(developerId);
  }

  @Get('applications/:id')
  @Public()
  @ApiOperation({ summary: 'Get application by ID' })
  @ApiResponse({ status: 200, type: ApplicationResponseDto })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationResponseDto> {
    return this.applicationService.findById(id);
  }

  @Get('applications/:id/stats')
  @ApiOperation({ summary: 'Get application statistics' })
  @ApiResponse({ status: 200, type: ApplicationStatsDto })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getStats(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationStatsDto> {
    return this.applicationService.getStats(id);
  }

  @Put('applications/:id')
  @ApiOperation({ summary: 'Update application' })
  @ApiResponse({ status: 200, type: ApplicationResponseDto })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationService.update(id, dto);
  }

  @Patch('applications/:id/status')
  @ApiOperation({ summary: 'Toggle application active status' })
  @ApiResponse({ status: 200, type: ApplicationResponseDto })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleStatusDto,
  ): Promise<ApplicationResponseDto> {
    return this.applicationService.toggleStatus(id, dto);
  }

  @Delete('applications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete application' })
  @ApiResponse({ status: 204, description: 'Application deleted' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.applicationService.delete(id);
  }
}
