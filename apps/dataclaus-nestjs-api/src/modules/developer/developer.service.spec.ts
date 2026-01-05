import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeveloperService } from './developer.service';
import { Developer, ApiKey } from './entities';

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
      expect(result.rawKey).toBeDefined();
      expect(result.rawKey.length).toBe(64);
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
});
