import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RecaptchaAssessment {
  tokenProperties?: {
    valid?: boolean;
    invalidReason?: string;
    action?: string;
  };
  riskAnalysis?: {
    score?: number;
    reasons?: string[];
  };
}

const DEFAULT_SCORE_THRESHOLD = 0.5;

/**
 * reCAPTCHA Enterprise verification service.
 *
 * Modes:
 *   - **enterprise** (production): Calls Google reCAPTCHA Enterprise REST API
 *     with `GOOGLE_PROJECT_ID` + `GOOGLE_API_KEY` + `RECAPTCHA_SITE_KEY`.
 *   - **simulation** (capstone/dev default): Token length > 20 passes, allowing
 *     local development without API credentials. Activated when
 *     `RECAPTCHA_SIMULATION=true` or no API key is configured.
 *
 * Score threshold defaults to 0.5; configurable via `RECAPTCHA_MIN_SCORE`.
 */
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  constructor(private readonly config: ConfigService) {}

  async verifyEnterprise(
    token: string,
    expectedAction: string,
  ): Promise<void> {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Missing reCAPTCHA token');
    }

    if (this.isSimulationMode()) {
      this.simulationVerify(token, expectedAction);
      return;
    }

    const projectId = this.config.get<string>('GOOGLE_PROJECT_ID');
    const apiKey = this.config.get<string>('GOOGLE_API_KEY');
    const siteKey = this.config.get<string>('RECAPTCHA_SITE_KEY');

    if (!projectId || !apiKey || !siteKey) {
      throw new UnauthorizedException(
        'reCAPTCHA enterprise is not fully configured',
      );
    }

    const url =
      `https://recaptchaenterprise.googleapis.com/v1/projects/` +
      `${projectId}/assessments?key=${apiKey}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: { token, expectedAction, siteKey },
        }),
      });
    } catch (err) {
      this.logger.error(`reCAPTCHA fetch failed: ${(err as Error).message}`);
      throw new UnauthorizedException('reCAPTCHA verification failed');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`reCAPTCHA HTTP ${res.status}: ${text}`);
      throw new UnauthorizedException('reCAPTCHA verification failed');
    }

    const json = (await res.json()) as RecaptchaAssessment;

    if (!json.tokenProperties?.valid) {
      this.logger.warn(
        `reCAPTCHA token invalid: ${json.tokenProperties?.invalidReason ?? 'unknown'}`,
      );
      throw new UnauthorizedException('reCAPTCHA token invalid');
    }

    if (
      expectedAction &&
      json.tokenProperties.action &&
      json.tokenProperties.action !== expectedAction
    ) {
      throw new UnauthorizedException('reCAPTCHA action mismatch');
    }

    const minScore = this.minScore();
    const score = json.riskAnalysis?.score ?? 0;
    if (score < minScore) {
      this.logger.warn(
        `reCAPTCHA risk score ${score} below threshold ${minScore}`,
      );
      throw new UnauthorizedException('reCAPTCHA risk score too low');
    }
  }

  private isSimulationMode(): boolean {
    if (
      this.config.get<string>('RECAPTCHA_SIMULATION', 'false').toLowerCase() ===
      'true'
    ) {
      return true;
    }
    return !this.config.get<string>('GOOGLE_API_KEY');
  }

  private simulationVerify(token: string, expectedAction: string): void {
    if (token.length < 20) {
      throw new UnauthorizedException(
        'reCAPTCHA token rejected (simulation mode)',
      );
    }
    this.logger.debug(
      `[reCAPTCHA simulation] action=${expectedAction} accepted`,
    );
  }

  private minScore(): number {
    const raw = this.config.get<string>('RECAPTCHA_MIN_SCORE');
    const parsed = raw ? parseFloat(raw) : DEFAULT_SCORE_THRESHOLD;
    return Number.isFinite(parsed) ? parsed : DEFAULT_SCORE_THRESHOLD;
  }
}
