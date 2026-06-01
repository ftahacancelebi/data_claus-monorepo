import { Controller, Get } from '@nestjs/common';
import {
  CurrentUser,
  CurrentUserData,
} from '../../common/decorators/current-user.decorator';
import { WatchStatsService } from './watch-stats.service';

@Controller('v1/watch-events')
export class WatchStatsController {
  constructor(private readonly service: WatchStatsService) {}

  @Get('my-stats')
  async getMyStats(@CurrentUser() user: CurrentUserData) {
    return this.service.getMyStats(user.id);
  }
}
