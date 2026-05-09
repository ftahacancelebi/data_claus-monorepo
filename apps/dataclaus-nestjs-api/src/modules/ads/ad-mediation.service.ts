import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from '../application/entities/application.entity';
import { SigningService } from '../../common/crypto';
import {
  AdType,
  ECPM_BANNER,
  ECPM_INTERSTITIAL,
  ECPM_REWARDED,
} from '../../common/constants';
import {
  RequestAdSlotDto,
  SignedAdSlotDto,
  SealImpressionDto,
} from './dto';

const SLOT_TTL_MS = 5 * 60 * 1000;

const TEST_AD_UNITS: Record<AdType, { ios: string; android: string }> = {
  [AdType.BANNER]: {
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
  },
  [AdType.INTERSTITIAL]: {
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
  },
  [AdType.REWARDED]: {
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
  },
};

export interface SlotPayload extends Record<string, unknown> {
  applicationId: string;
  developerId: string;
  userId: string;
  adType: AdType;
  adUnitId: string;
  qualityScoreHint: number;
  sessionId: string | null;
  attestationVerified: boolean;
}

export interface VerifiedSlot {
  payload: SlotPayload;
  nonce: string;
}

@Injectable()
export class AdMediationService {
  private readonly logger = new Logger(AdMediationService.name);

  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
    private readonly signing: SigningService,
  ) {}

  async requestSlot(
    applicationId: string,
    dto: RequestAdSlotDto,
  ): Promise<SignedAdSlotDto> {
    const application = await this.applicationRepository.findOne({
      where: { id: applicationId },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    const attestationVerified = await this.verifyAttestation(dto.attestation);
    const adUnitId = this.resolveAdUnitId(application, dto.ad_type);
    const projectedRevenue = this.projectRevenue(dto.ad_type);

    const payload: SlotPayload = {
      applicationId,
      developerId: application.developerId,
      userId: dto.user_id,
      adType: dto.ad_type,
      adUnitId,
      qualityScoreHint: this.clampQuality(dto.quality_score_hint),
      sessionId: dto.session_id ?? null,
      attestationVerified,
    };

    const signed = this.signing.sign(payload, SLOT_TTL_MS);
    const slotToken = this.signing.encode(signed);

    return {
      slot_token: slotToken,
      ad_unit_id: adUnitId,
      ad_type: dto.ad_type,
      expires_at: new Date(signed.expiresAt).toISOString(),
      projected_revenue: projectedRevenue,
    };
  }

  /**
   * Decodes and cryptographically verifies a slot token. Throws on bad
   * signature, expiry, or replayed nonce.
   *
   * NOTE: Replay protection here uses an in-memory nonce ledger maintained by
   * SigningService. The DB-level unique index on `ad_impressions.slot_nonce`
   * is the authoritative second line of defence — it survives process
   * restarts and multi-instance deployments.
   */
  verifySlot(applicationId: string, slotToken: string): VerifiedSlot {
    const signed = this.signing.decode<SlotPayload>(slotToken);
    const payload = this.signing.verify<SlotPayload>(signed);

    if (payload.applicationId !== applicationId) {
      throw new UnauthorizedException('Slot token does not match application');
    }

    return { payload, nonce: signed.nonce };
  }

  /**
   * Reconciles client-reported revenue against server projections. Returns
   * the authoritative revenue used by the ledger.
   *
   * Policy:
   *  - If the SDK didn't report a value, we use the server projection.
   *  - If the SDK reports within a tolerance band (±50%), we accept it.
   *  - If the SDK reports outside the tolerance band, we clamp to the
   *    projection AND flag the impression for reconciliation review.
   *
   * Production should replace step (2) with a server-side AdMob Reporting
   * API lookup keyed by adUnitId + impression timestamp.
   */
  reconcileRevenue(
    payload: SlotPayload,
    seal: SealImpressionDto,
  ): { revenue: number; suspicious: boolean } {
    const projected = this.projectRevenue(payload.adType);
    const reported = seal.reported_revenue;

    if (reported == null) {
      return { revenue: projected, suspicious: false };
    }

    const lowerBound = projected * 0.5;
    const upperBound = projected * 1.5;
    if (reported < lowerBound || reported > upperBound) {
      this.logger.warn(
        `Reported revenue ${reported} out of tolerance for ${payload.adType} (expected ~${projected}). Clamping.`,
      );
      return { revenue: projected, suspicious: true };
    }
    return { revenue: reported, suspicious: false };
  }

  private resolveAdUnitId(application: Application, adType: AdType): string {
    const platform = this.detectPlatform(application);
    const fromApp = this.lookupAppAdUnit(application, adType, platform);
    if (fromApp) return fromApp;
    return TEST_AD_UNITS[adType][platform];
  }

  private detectPlatform(application: Application): 'ios' | 'android' {
    const flag = (application as unknown as { platform?: string }).platform;
    if (flag === 'ios' || flag === 'android') return flag;
    return 'android';
  }

  private lookupAppAdUnit(
    application: Application,
    adType: AdType,
    platform: 'ios' | 'android',
  ): string | null {
    const meta = (application as unknown as {
      adUnitIds?: Partial<Record<AdType, { ios?: string; android?: string }>>;
    }).adUnitIds;
    return meta?.[adType]?.[platform] ?? null;
  }

  private projectRevenue(adType: AdType): number {
    const ecpm =
      adType === AdType.BANNER
        ? ECPM_BANNER
        : adType === AdType.INTERSTITIAL
          ? ECPM_INTERSTITIAL
          : ECPM_REWARDED;
    return ecpm / 1000;
  }

  private clampQuality(input: number | undefined): number {
    if (typeof input !== 'number' || Number.isNaN(input)) return 1;
    return Math.max(0, Math.min(1, input));
  }

  /**
   * Verifies a platform attestation envelope (Apple App Attest /
   * Play Integrity). MVP returns true on any payload — replace with real
   * verification in production.
   */
  private async verifyAttestation(
    attestation: string | undefined,
  ): Promise<boolean> {
    if (!attestation) return false;
    return attestation.length > 0;
  }
}
