import { Controller, Get, Param, ParseUUIDPipe, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  DataClausUserService,
  UserResponseDto,
  UserEarningsDto,
} from './dataclaus-user.service';
import { Public } from '../../common/decorators';

@ApiTags('users')
@Controller('users')
export class DataClausUserController {
  constructor(private readonly userService: DataClausUserService) {}

  @Get('me/earnings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user earnings' })
  @ApiResponse({ status: 200, description: 'Earnings retrieved' })
  async getMyEarnings(@Request() req: any): Promise<UserEarningsDto> {
    return this.userService.getEarnings(req.user.sub);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.userService.findById(id);
  }

  @Get(':id/earnings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user earnings by ID' })
  @ApiResponse({ status: 200, description: 'Earnings retrieved' })
  async getEarnings(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserEarningsDto> {
    return this.userService.getEarnings(id);
  }
}
