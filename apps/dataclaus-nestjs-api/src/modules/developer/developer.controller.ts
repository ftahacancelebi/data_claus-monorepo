import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeveloperService } from './developer.service';
import {
  RegisterDeveloperDto,
  UpdateUserShareDto,
  GenerateApiKeyDto,
  DeveloperResponseDto,
  ApiKeyResponseDto,
  GeneratedApiKeyResponseDto,
} from './dto';
import { Public } from '../../common/decorators';
import { AuditAction } from '../audit/audit.decorator';

@ApiTags('developers')
@Controller('developers')
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Register a new developer' })
  @ApiResponse({ status: 201, type: DeveloperResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(
    @Body() dto: RegisterDeveloperDto,
  ): Promise<DeveloperResponseDto> {
    return this.developerService.register(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get developer by ID' })
  @ApiResponse({ status: 200, type: DeveloperResponseDto })
  @ApiResponse({ status: 404, description: 'Developer not found' })
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeveloperResponseDto> {
    return this.developerService.findById(id);
  }

  @Put(':id/user-share')
  @ApiOperation({ summary: 'Update developer user share percentage' })
  @ApiResponse({ status: 200, type: DeveloperResponseDto })
  @ApiResponse({ status: 404, description: 'Developer not found' })
  async updateUserShare(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserShareDto,
  ): Promise<DeveloperResponseDto> {
    return this.developerService.updateUserShare(id, dto);
  }

  @Post(':id/api-keys')
  @AuditAction({ action: 'developer.api_key.created', targetType: 'api_key' })
  @ApiOperation({ summary: 'Generate a new API key for developer' })
  @ApiResponse({ status: 201, type: GeneratedApiKeyResponseDto })
  @ApiResponse({ status: 404, description: 'Developer not found' })
  async generateApiKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateApiKeyDto,
  ): Promise<GeneratedApiKeyResponseDto> {
    return this.developerService.generateApiKey(id, dto);
  }

  @Get(':id/api-keys')
  @ApiOperation({ summary: 'List all API keys for developer' })
  @ApiResponse({ status: 200, type: [ApiKeyResponseDto] })
  @ApiResponse({ status: 404, description: 'Developer not found' })
  async listApiKeys(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiKeyResponseDto[]> {
    return this.developerService.listApiKeys(id);
  }

  @Delete(':id/api-keys/:keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction({
    action: 'developer.api_key.revoked',
    targetType: 'api_key',
    targetIdParam: 'keyId',
  })
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 204, description: 'API key revoked' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revokeApiKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ): Promise<void> {
    return this.developerService.revokeApiKey(id, keyId);
  }

  @Post(':id/api-keys/:keyId/rotate')
  @AuditAction({
    action: 'developer.api_key.rotated',
    targetType: 'api_key',
    targetIdParam: 'keyId',
  })
  @ApiOperation({
    summary:
      'Rotate an API key. Returns the new key and the old key’s expiry timestamp.',
  })
  @ApiResponse({ status: 201, type: GeneratedApiKeyResponseDto })
  @ApiResponse({ status: 400, description: 'Key already rotated or inactive' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async rotateApiKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('keyId', ParseUUIDPipe) keyId: string,
  ) {
    return this.developerService.rotateApiKey(id, keyId);
  }
}
