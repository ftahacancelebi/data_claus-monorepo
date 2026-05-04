import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { Developer, ApiKey } from './entities';
import { WalletService } from '../wallet/wallet.service';

describe('DeveloperService', () => {
  let service: DeveloperService;
  let developerRepo: jest.Mocked<Repository<Developer>>;
  let apiKeyRepo: jest.Mocked<Repository<ApiKey>>;

  const mockDeveloper = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Developer',
    email: 'test@example.com',
    password: 'hashedpassword',
    userSharePercent: 70,
    createdAt: new Date(),
    updatedAt: new Date(),
    setUserSharePercent: jest.fn(),
    getDeveloperSharePercent: jest.fn().mockReturnValue(25),
  } as unknown as Developer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeveloperService,
        {
          provide: getRepositoryToken(Developer),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: WalletService,
          useValue: {
            create: jest.fn(async () => ({ id: 'wallet-1' })),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DeveloperService>(DeveloperService);
    developerRepo = module.get(getRepositoryToken(Developer));
    apiKeyRepo = module.get(getRepositoryToken(ApiKey));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a new developer', async () => {
      developerRepo.findOne.mockResolvedValue(null);
      developerRepo.create.mockReturnValue(mockDeveloper);
      developerRepo.save.mockResolvedValue(mockDeveloper);

      const result = await service.register({
        name: 'Test Developer',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.email).toBe('test@example.com');
      expect(developerRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email exists', async () => {
      developerRepo.findOne.mockResolvedValue(mockDeveloper);

      await expect(
        service.register({
          name: 'Test Developer',
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return developer by id', async () => {
      developerRepo.findOne.mockResolvedValue(mockDeveloper);

      const result = await service.findById(mockDeveloper.id);

      expect(result.id).toBe(mockDeveloper.id);
    });

    it('should throw NotFoundException if not found', async () => {
      developerRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateApiKey', () => {
    it('should create a new API key', async () => {
      developerRepo.findOne.mockResolvedValue(mockDeveloper);
      apiKeyRepo.create.mockReturnValue({
        id: 'key-id',
        keyPrefix: 'abcd1234',
        name: 'Test Key',
        isActive: true,
        createdAt: new Date(),
      } as ApiKey);
      apiKeyRepo.save.mockResolvedValue({
        id: 'key-id',
        keyPrefix: 'abcd1234',
        name: 'Test Key',
        isActive: true,
        createdAt: new Date(),
      } as ApiKey);

      const result = await service.generateApiKey(mockDeveloper.id, {
        name: 'Test Key',
      });

      expect(result.name).toBe('Test Key');
      expect(result.raw_key).toBeDefined();
      expect(result.raw_key.length).toBe(64);
    });
  });

  describe('listApiKeys', () => {
    it('should return list of API keys', async () => {
      developerRepo.findOne.mockResolvedValue(mockDeveloper);
      apiKeyRepo.find.mockResolvedValue([
        {
          id: 'key-1',
          keyPrefix: 'abcd1234',
          name: 'Key 1',
          isActive: true,
          lastUsedAt: null,
          createdAt: new Date(),
        } as ApiKey,
      ]);

      const result = await service.listApiKeys(mockDeveloper.id);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Key 1');
    });
  });

  describe('rotateApiKey', () => {
    const oldKey = {
      id: 'old-key-id',
      developerId: mockDeveloper.id,
      applicationId: null,
      name: 'Production',
      keyHash: 'old-hash',
      keyPrefix: 'oldprfx0',
      isActive: true,
      lastUsedAt: null,
      expiresAt: null,
      rotatedToId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as ApiKey;

    it('issues a new key and schedules the old one for expiry', async () => {
      apiKeyRepo.findOne.mockResolvedValue(oldKey);
      apiKeyRepo.create.mockReturnValue({
        id: 'new-key-id',
        keyPrefix: 'newprfx0',
        name: 'Production (rotated)',
        isActive: true,
        createdAt: new Date(),
      } as ApiKey);
      apiKeyRepo.save.mockImplementation(async (v) => v as ApiKey);

      const result = await service.rotateApiKey(mockDeveloper.id, oldKey.id);

      expect(result.newKey.raw_key).toBeDefined();
      expect(result.newKey.raw_key.length).toBe(64);
      expect(result.oldKey.id).toBe(oldKey.id);
      // Grace period: ~7 days from now
      const expectedMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
      expect(
        Math.abs(result.oldKey.expiresAt.getTime() - expectedMs),
      ).toBeLessThan(2_000);
    });

    it('rejects rotation of an inactive key', async () => {
      apiKeyRepo.findOne.mockResolvedValue({
        ...oldKey,
        isActive: false,
      } as unknown as ApiKey);
      await expect(
        service.rotateApiKey(mockDeveloper.id, oldKey.id),
      ).rejects.toThrow(/inactive/);
    });

    it('rejects rotation of an already-rotated key', async () => {
      apiKeyRepo.findOne.mockResolvedValue({
        ...oldKey,
        rotatedToId: 'other',
      } as unknown as ApiKey);
      await expect(
        service.rotateApiKey(mockDeveloper.id, oldKey.id),
      ).rejects.toThrow(/already been rotated/);
    });

    it('throws NotFoundException if the key does not belong to the developer', async () => {
      apiKeyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.rotateApiKey(mockDeveloper.id, 'other-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateApiKey', () => {
    it('skips keys whose grace window has elapsed', async () => {
      apiKeyRepo.find.mockResolvedValue([
        {
          id: 'k1',
          keyPrefix: 'pfx00000',
          isActive: true,
          keyHash: 'unused',
          expiresAt: new Date(Date.now() - 60_000),
        } as ApiKey,
      ]);
      const result = await service.validateApiKey('pfx00000aaaaaa');
      expect(result).toBeNull();
    });
  });
});
