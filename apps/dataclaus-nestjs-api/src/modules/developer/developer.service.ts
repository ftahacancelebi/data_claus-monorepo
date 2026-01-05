import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Developer, ApiKey } from './entities';
import {
  RegisterDeveloperDto,
  UpdateUserShareDto,
  GenerateApiKeyDto,
  DeveloperResponseDto,
  ApiKeyResponseDto,
  GeneratedApiKeyResponseDto,
} from './dto';
import { WalletService } from '../wallet/wallet.service';
import { WalletType, PLATFORM_FEE_PERCENT } from '../../common/constants';

@Injectable()
export class DeveloperService {
  constructor(
    @InjectRepository(Developer)
    private readonly developerRepository: Repository<Developer>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly walletService: WalletService,
  ) {}

  async register(dto: RegisterDeveloperDto): Promise<DeveloperResponseDto> {
    // Check if email already exists
    const existing = await this.developerRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create developer
    const developer = this.developerRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
    });

    const savedDeveloper = await this.developerRepository.save(developer);

    // Create developer wallet
    await this.walletService.create({
      owner_id: savedDeveloper.id,
      type: WalletType.DEVELOPER,
      currency: 'USD',
    });

    return this.toResponseDto(savedDeveloper);
  }

  async findById(id: string): Promise<DeveloperResponseDto> {
    const developer = await this.developerRepository.findOne({
      where: { id },
    });

    if (!developer) {
      throw new NotFoundException('Developer not found');
    }

    return this.toResponseDto(developer);
  }

  async findByEmail(email: string): Promise<Developer | null> {
    return this.developerRepository.findOne({ where: { email } });
  }

  async updateUserShare(
    id: string,
    dto: UpdateUserShareDto,
  ): Promise<DeveloperResponseDto> {
    const developer = await this.developerRepository.findOne({
      where: { id },
    });

    if (!developer) {
      throw new NotFoundException('Developer not found');
    }

    developer.setUserSharePercent(dto.user_share_percent);
    await this.developerRepository.save(developer);

    return this.toResponseDto(developer);
  }

  async generateApiKey(
    developerId: string,
    dto: GenerateApiKeyDto,
  ): Promise<GeneratedApiKeyResponseDto> {
    const developer = await this.developerRepository.findOne({
      where: { id: developerId },
    });

    if (!developer) {
      throw new NotFoundException('Developer not found');
    }

    // Generate random key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const keyPrefix = rawKey.substring(0, 8);
    const keyHash = await bcrypt.hash(rawKey, 10);

    const apiKey = this.apiKeyRepository.create({
      developerId,
      applicationId: dto.application_id || null,
      name: dto.name,
      keyHash,
      keyPrefix,
      isActive: true,
    });

    await this.apiKeyRepository.save(apiKey);

    return {
      id: apiKey.id,
      key_prefix: apiKey.keyPrefix,
      name: apiKey.name,
      is_active: apiKey.isActive,
      created_at: apiKey.createdAt,
      raw_key: rawKey, // Only returned once
    };
  }

  async listApiKeys(developerId: string): Promise<ApiKeyResponseDto[]> {
    const developer = await this.developerRepository.findOne({
      where: { id: developerId },
    });

    if (!developer) {
      throw new NotFoundException('Developer not found');
    }

    const apiKeys = await this.apiKeyRepository.find({
      where: { developerId },
      order: { createdAt: 'DESC' },
    });

    return apiKeys.map((key) => ({
      id: key.id,
      key_prefix: key.keyPrefix,
      name: key.name,
      is_active: key.isActive,
      last_used_at: key.lastUsedAt ?? undefined,
      created_at: key.createdAt,
    }));
  }

  async revokeApiKey(developerId: string, keyId: string): Promise<void> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: keyId, developerId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    apiKey.isActive = false;
    await this.apiKeyRepository.save(apiKey);
  }

  async validateApiKey(rawKey: string): Promise<ApiKey | null> {
    const keyPrefix = rawKey.substring(0, 8);

    // Find potential matches by prefix
    const candidates = await this.apiKeyRepository.find({
      where: { keyPrefix, isActive: true },
    });

    for (const candidate of candidates) {
      if (await bcrypt.compare(rawKey, candidate.keyHash)) {
        // Update last used
        candidate.lastUsedAt = new Date();
        await this.apiKeyRepository.save(candidate);
        return candidate;
      }
    }

    return null;
  }

  private toResponseDto(developer: Developer): DeveloperResponseDto {
    return {
      id: developer.id,
      name: developer.name,
      email: developer.email,
      user_share_percent: developer.userSharePercent,
      dev_share_percent:
        100 - PLATFORM_FEE_PERCENT - developer.userSharePercent,
      created_at: developer.createdAt,
      updated_at: developer.updatedAt,
    };
  }
}
