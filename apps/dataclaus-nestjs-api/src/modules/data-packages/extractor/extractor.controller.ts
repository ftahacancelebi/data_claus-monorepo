import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUserData } from '../../../common/decorators/current-user.decorator';
import { Role, Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ApplicationExtractorService } from './application-extractor.service';

@ApiTags('Packages')
@Controller('v1/packages/extract')
@ApiBearerAuth()
export class ExtractorController {
  constructor(private readonly extractor: ApplicationExtractorService) {}

  @Get('eligible-apps')
  @UseGuards(RolesGuard)
  @Roles(Role.DEVELOPER, Role.ADMIN)
  @ApiOperation({ summary: 'List developer apps eligible for auto-packaging (≥100 events, ≥5 users)' })
  async listEligible(@CurrentUser() user: CurrentUserData) {
    return this.extractor.listEligible(user.id);
  }

  @Get('preview/:appId')
  @UseGuards(RolesGuard)
  @Roles(Role.DEVELOPER, Role.ADMIN)
  @ApiOperation({ summary: "Generate a package draft from an app's scored_events (read-only, no side-effects)" })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date string (default: 30d ago)' })
  @ApiQuery({ name: 'to',   required: false, description: 'ISO date string (default: now)' })
  async preview(
    @Param('appId', new ParseUUIDPipe()) appId: string,
    @CurrentUser() user: CurrentUserData,
    @Query('from') fromStr?: string,
    @Query('to')   toStr?: string,
  ) {
    let dateRange: { from: Date; to: Date } | undefined;
    if (fromStr || toStr) {
      const from = fromStr ? new Date(fromStr) : undefined;
      const to   = toStr   ? new Date(toStr)   : undefined;
      if (from && isNaN(from.getTime())) throw new BadRequestException('Invalid "from" date');
      if (to   && isNaN(to.getTime()))   throw new BadRequestException('Invalid "to" date');
      if (from && to && from > to)        throw new BadRequestException('"from" must be before "to"');
      dateRange = { from: from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to: to ?? new Date() };
    }
    return this.extractor.extract(appId, user.id, user.role, dateRange);
  }
}
