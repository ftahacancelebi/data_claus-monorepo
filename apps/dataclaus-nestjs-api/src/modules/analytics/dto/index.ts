import { ApiProperty } from '@nestjs/swagger';

export class DashboardStatsDto {
  @ApiProperty({ description: 'Total number of events/impressions' })
  total_events: number;

  @ApiProperty({ description: 'Total number of unique users' })
  total_users: number;

  @ApiProperty({ description: 'Total number of registered developers' })
  total_developers: number;

  @ApiProperty({ description: 'Average quality score' })
  average_quality: number;

  @ApiProperty({ description: 'Total payouts in platform currency' })
  total_payouts: number;

  @ApiProperty({ description: 'Number of active campaigns' })
  active_campaigns: number;
}
