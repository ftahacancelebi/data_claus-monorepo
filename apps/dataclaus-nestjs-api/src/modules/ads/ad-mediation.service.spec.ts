import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AdMediationService } from './ad-mediation.service';
import { Application } from '../application/entities/application.entity';
import { SigningService } from '../../common/crypto/signing.service';
import { AdType } from '../../common/constants';

describe('AdMediationService', () => {
  let service: AdMediationService;
  let signing: SigningService;
  let appRepo: { findOne: jest.Mock };

  const sampleApp = {
    id: '11111111-1111-1111-1111-111111111111',
    developerId: '22222222-2222-2222-2222-222222222222',
    userSharePercent: 70,
  } as Partial<Application>;

  beforeEach(async () => {
    appRepo = { findOne: jest.fn().mockResolvedValue(sampleApp) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdMediationService,
        SigningService,
        {
          provide: ConfigService,
          useValue: {
            get: () => 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          },
        },
        { provide: getRepositoryToken(Application), useValue: appRepo },
      ],
    }).compile();

    service = module.get(AdMediationService);
    signing = module.get(SigningService);
  });

  describe('requestSlot', () => {
    it('issues a signed slot bound to the app', async () => {
      const slot = await service.requestSlot(sampleApp.id!, {
        ad_type: AdType.REWARDED,
        user_id: '33333333-3333-3333-3333-333333333333',
      });
      expect(slot.slot_token).toBeTruthy();
      expect(slot.ad_unit_id).toBeTruthy();
      expect(slot.ad_type).toBe(AdType.REWARDED);
      expect(slot.projected_revenue).toBeGreaterThan(0);

      const decoded = signing.decode(slot.slot_token);
      const verified = signing.verify(decoded);
      expect(verified.applicationId).toBe(sampleApp.id);
      expect(verified.userId).toBe('33333333-3333-3333-3333-333333333333');
      expect(verified.adType).toBe(AdType.REWARDED);
    });

    it('throws when app does not exist', async () => {
      appRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.requestSlot(sampleApp.id!, {
          ad_type: AdType.BANNER,
          user_id: '33333333-3333-3333-3333-333333333333',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('clamps quality_score_hint into [0, 1]', async () => {
      const slot = await service.requestSlot(sampleApp.id!, {
        ad_type: AdType.BANNER,
        user_id: '33333333-3333-3333-3333-333333333333',
        quality_score_hint: 999,
      });
      const verified = signing.verify(signing.decode(slot.slot_token));
      expect(verified.qualityScoreHint).toBe(1);
    });
  });

  describe('verifySlot', () => {
    it('accepts a valid token', async () => {
      const slot = await service.requestSlot(sampleApp.id!, {
        ad_type: AdType.INTERSTITIAL,
        user_id: '33333333-3333-3333-3333-333333333333',
      });
      const verified = service.verifySlot(sampleApp.id!, slot.slot_token);
      expect(verified.payload.applicationId).toBe(sampleApp.id);
      expect(verified.nonce).toBeTruthy();
    });

    it('rejects token issued for a different app', async () => {
      const slot = await service.requestSlot(sampleApp.id!, {
        ad_type: AdType.BANNER,
        user_id: '33333333-3333-3333-3333-333333333333',
      });
      expect(() =>
        service.verifySlot(
          '99999999-9999-9999-9999-999999999999',
          slot.slot_token,
        ),
      ).toThrow(UnauthorizedException);
    });

    it('rejects a tampered token', async () => {
      const slot = await service.requestSlot(sampleApp.id!, {
        ad_type: AdType.BANNER,
        user_id: '33333333-3333-3333-3333-333333333333',
      });
      // Flip a character in the token
      const tampered = slot.slot_token.slice(0, -2) + 'AA';
      expect(() => service.verifySlot(sampleApp.id!, tampered)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('reconcileRevenue', () => {
    const payload = {
      applicationId: sampleApp.id!,
      developerId: sampleApp.developerId!,
      userId: '33333333-3333-3333-3333-333333333333',
      adType: AdType.REWARDED,
      adUnitId: 'unit',
      qualityScoreHint: 1,
      sessionId: null,
      attestationVerified: false,
    };

    it('uses server projection when client reports nothing', () => {
      const result = service.reconcileRevenue(payload, { slot_token: 'x' });
      expect(result.revenue).toBeGreaterThan(0);
      expect(result.suspicious).toBe(false);
    });

    it('accepts in-tolerance client values', () => {
      // Rewarded eCPM = 15.0 → projection = 0.015. Within ±50%.
      const result = service.reconcileRevenue(payload, {
        slot_token: 'x',
        reported_revenue: 0.018,
      });
      expect(result.revenue).toBeCloseTo(0.018, 6);
      expect(result.suspicious).toBe(false);
    });

    it('clamps and flags out-of-tolerance values', () => {
      // 1000x the expected projection — clearly malicious
      const result = service.reconcileRevenue(payload, {
        slot_token: 'x',
        reported_revenue: 15,
      });
      expect(result.suspicious).toBe(true);
      expect(result.revenue).toBeCloseTo(0.015, 6);
    });

    it('also clamps absurdly low values', () => {
      const result = service.reconcileRevenue(payload, {
        slot_token: 'x',
        reported_revenue: 0.0000001,
      });
      expect(result.suspicious).toBe(true);
      // Falls back to projection rather than the lying value
      expect(result.revenue).toBeCloseTo(0.015, 6);
    });
  });
});
