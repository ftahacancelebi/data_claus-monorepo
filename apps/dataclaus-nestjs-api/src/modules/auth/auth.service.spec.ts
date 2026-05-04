import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { OtpRequest } from './entities';
import { DataClausUser } from '../dataclaus-user/entities/dataclaus-user.entity';
import { DeveloperService } from '../developer/developer.service';
import { WalletService } from '../wallet/wallet.service';
import { EmailService } from '../email/email.service';
import { RecaptchaService } from '../recaptcha/recaptcha.service';

describe('AuthService — OTP flow', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<Repository<DataClausUser>>;
  let otpRepo: jest.Mocked<Repository<OtpRequest>>;
  let emailService: jest.Mocked<EmailService>;
  let walletService: jest.Mocked<WalletService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DeveloperService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            register: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(() => 'jwt'), verify: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'console') },
        },
        {
          provide: getRepositoryToken(DataClausUser),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((v) => v),
            save: jest.fn((v) => ({ id: 'user-1', ...v })),
          },
        },
        {
          provide: getRepositoryToken(OtpRequest),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((v) => v),
            save: jest.fn(async (v) => ({ id: 'otp-1', ...v })),
            update: jest.fn(),
            delete: jest.fn(async () => ({ affected: 0 })),
          },
        },
        {
          provide: WalletService,
          useValue: {
            create: jest.fn(async () => ({ id: 'wallet-1' })),
          },
        },
        {
          provide: EmailService,
          useValue: { sendOtp: jest.fn(async () => undefined) },
        },
        {
          provide: RecaptchaService,
          useValue: {
            verifyEnterprise: jest.fn(async () => undefined),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepo = module.get(getRepositoryToken(DataClausUser));
    otpRepo = module.get(getRepositoryToken(OtpRequest));
    emailService = module.get(EmailService);
    walletService = module.get(WalletService);
    jwtService = module.get(JwtService);
  });

  describe('requestOtp', () => {
    it('persists a hashed OTP and emails the code', async () => {
      const result = await service.requestOtp('User@example.com');
      expect(result.status).toBe('sent');
      expect(result.expiresInSeconds).toBe(300);
      expect(otpRepo.update).toHaveBeenCalled();
      expect(otpRepo.save).toHaveBeenCalled();
      expect(emailService.sendOtp).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('invalidates prior unused OTPs for the same email', async () => {
      await service.requestOtp('user@example.com');
      expect(otpRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' }),
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
    });
  });

  describe('verifyOtp', () => {
    it('throws when no OTP exists', async () => {
      otpRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.verifyOtp('user@example.com', '123456'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws 429 once attempts limit reached', async () => {
      otpRepo.findOne.mockResolvedValueOnce({
        id: 'otp-1',
        email: 'user@example.com',
        codeHash: 'h',
        expiresAt: new Date(Date.now() + 60000),
        attempts: 5,
        usedAt: null,
      } as OtpRequest);
      await expect(
        service.verifyOtp('user@example.com', '123456'),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('increments attempts on wrong code and throws 401', async () => {
      const codeHash = await bcrypt.hash('111111', 4);
      const otp = {
        id: 'otp-1',
        email: 'user@example.com',
        codeHash,
        expiresAt: new Date(Date.now() + 60000),
        attempts: 0,
        usedAt: null,
      } as OtpRequest;
      otpRepo.findOne.mockResolvedValueOnce(otp);

      await expect(
        service.verifyOtp('user@example.com', '999999'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(otp.attempts).toBe(1);
      expect(otpRepo.save).toHaveBeenCalledWith(otp);
    });

    it('issues access + refresh tokens for a valid OTP and provisions user/wallet', async () => {
      const codeHash = await bcrypt.hash('424242', 4);
      otpRepo.findOne.mockResolvedValueOnce({
        id: 'otp-1',
        email: 'new@example.com',
        codeHash,
        expiresAt: new Date(Date.now() + 60000),
        attempts: 0,
        usedAt: null,
      } as OtpRequest);
      userRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.verifyOtp('new@example.com', '424242');

      expect(walletService.create).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('jwt');
      expect(result.refreshToken).toBe('jwt');
      expect(result.user.email).toBe('new@example.com');
    });
  });

  describe('refresh', () => {
    it('rejects access tokens', async () => {
      jwtService.verify.mockReturnValueOnce({
        sub: 'u1',
        email: 'a@b.c',
        role: 'user',
        type: 'access',
      } as never);
      await expect(service.refresh('token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('issues new tokens for valid refresh tokens', async () => {
      jwtService.verify.mockReturnValueOnce({
        sub: 'u1',
        email: 'a@b.c',
        role: 'user',
        type: 'refresh',
      } as never);
      userRepo.findOne.mockResolvedValueOnce({
        id: 'u1',
        email: 'a@b.c',
        displayName: 'Alice',
      } as DataClausUser);

      const result = await service.refresh('token');
      expect(result.accessToken).toBe('jwt');
      expect(result.refreshToken).toBe('jwt');
    });
  });
});
