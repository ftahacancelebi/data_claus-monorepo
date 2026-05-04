import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';

describe('RecaptchaService', () => {
  const buildService = async (overrides: Record<string, string> = {}) => {
    const env: Record<string, string> = {
      RECAPTCHA_SIMULATION: 'true',
      ...overrides,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecaptchaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: string) => env[key] ?? defaultValue,
            ),
          },
        },
      ],
    }).compile();
    return module.get(RecaptchaService);
  };

  describe('simulation mode', () => {
    it('rejects empty tokens', async () => {
      const service = await buildService();
      await expect(
        service.verifyEnterprise('', 'OTP_REQUEST'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects short tokens', async () => {
      const service = await buildService();
      await expect(
        service.verifyEnterprise('short', 'OTP_REQUEST'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts long-enough tokens', async () => {
      const service = await buildService();
      await expect(
        service.verifyEnterprise('a'.repeat(40), 'OTP_REQUEST'),
      ).resolves.toBeUndefined();
    });
  });

  describe('enterprise mode', () => {
    const realFetch = global.fetch;
    afterEach(() => {
      global.fetch = realFetch;
      jest.restoreAllMocks();
    });

    const baseEnv = {
      RECAPTCHA_SIMULATION: 'false',
      GOOGLE_PROJECT_ID: 'p1',
      GOOGLE_API_KEY: 'k1',
      RECAPTCHA_SITE_KEY: 's1',
    };

    it('rejects when token is invalid', async () => {
      global.fetch = jest.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({
              tokenProperties: { valid: false, invalidReason: 'EXPIRED' },
            }),
          }) as unknown as Response,
      );
      const service = await buildService(baseEnv);
      await expect(
        service.verifyEnterprise('a'.repeat(40), 'OTP_REQUEST'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when score is below threshold', async () => {
      global.fetch = jest.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({
              tokenProperties: {
                valid: true,
                action: 'OTP_REQUEST',
              },
              riskAnalysis: { score: 0.2 },
            }),
          }) as unknown as Response,
      );
      const service = await buildService(baseEnv);
      await expect(
        service.verifyEnterprise('a'.repeat(40), 'OTP_REQUEST'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when action mismatches', async () => {
      global.fetch = jest.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({
              tokenProperties: { valid: true, action: 'LOGIN' },
              riskAnalysis: { score: 0.9 },
            }),
          }) as unknown as Response,
      );
      const service = await buildService(baseEnv);
      await expect(
        service.verifyEnterprise('a'.repeat(40), 'OTP_REQUEST'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts valid response above threshold', async () => {
      global.fetch = jest.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({
              tokenProperties: { valid: true, action: 'OTP_REQUEST' },
              riskAnalysis: { score: 0.9 },
            }),
          }) as unknown as Response,
      );
      const service = await buildService(baseEnv);
      await expect(
        service.verifyEnterprise('a'.repeat(40), 'OTP_REQUEST'),
      ).resolves.toBeUndefined();
    });

    it('falls back to simulation when API key is missing', async () => {
      const service = await buildService({
        RECAPTCHA_SIMULATION: 'false',
        // No GOOGLE_API_KEY → simulation fallback
      });
      await expect(
        service.verifyEnterprise('a'.repeat(40), 'OTP_REQUEST'),
      ).resolves.toBeUndefined();
    });
  });
});
