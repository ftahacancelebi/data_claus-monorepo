import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService, PlatformStatsDto, AdminUserDto } from './admin.service';
import { Roles, Role } from '../../common/decorators';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(Role.DEVELOPER, Role.ADMIN) // For now, developers can access admin
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  @ApiResponse({
    status: 200,
    description: 'Platform stats retrieved successfully',
  })
  async getStats(): Promise<PlatformStatsDto> {
    return this.adminService.getPlatformStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all platform users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUsers(): Promise<AdminUserDto[]> {
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminUserDto | null> {
    return this.adminService.getUserById(id);
  }
}
