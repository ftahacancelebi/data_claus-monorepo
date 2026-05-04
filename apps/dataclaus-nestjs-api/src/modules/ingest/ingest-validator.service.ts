import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as semver from 'semver';
import { Application } from '../application/entities';
import { IngestEventDto } from './dto/ingest-event.dto';

export interface ValidationVerdict {
  ok: boolean;
  reason?: string;
}

const FUTURE_SKEW_MS = 60_000; // events claiming the future > 60s = reject
const MAX_AGE_MS = 24 * 3600 * 1000; // older than 1 day = reject
const DEFAULT_FRAUD_THRESHOLD = 0.7;
const DEFAULT_RATE_LIMIT_PER_SEC = 50;

interface RateBucket {
  count: number;
  windowStart: number; // unix ms truncated to second
}

/**
 * Server-side validation of ingest events.
 *
 * Checks (in order):
 *   1. Timestamp sanity (no future skew, not too old)
 *   2. SDK fraudScore threshold (bot rejection)
 *   3. Per-user rate limit (sliding 1-second bucket)
 *   4. SDK version blacklist (reject pre-fraud-detection clients)
 */
@Injectable()
export class IngestValidatorService {
  private readonly logger = new Logger(IngestValidatorService.name);
  private readonly buckets = new Map<string, RateBucket>();
  private readonly minSdkVersion: string;

  constructor(private readonly configService: ConfigService) {
    this.minSdkVersion =
      this.configService.get<string>('SDK_MIN_VERSION') ?? '0.0.1';
  }

  validate(event: IngestEventDto, app: Application): ValidationVerdict {
    // 1. Timestamp sanity
    const ts = Date.parse(event.timestamp);
    if (Number.isNaN(ts)) {
      return { ok: false, reason: 'invalid_timestamp' };
    }
    const now = Date.now();
    if (ts > now + FUTURE_SKEW_MS) {
      return { ok: false, reason: 'future_timestamp' };
    }
    if (ts < now - MAX_AGE_MS) {
      return { ok: false, reason: 'too_old' };
    }

    // 2. fraudScore threshold (reads optional per-app override stored in
    // application metadata; defaults to 0.7)
    const threshold = this.resolveFraudThreshold(app);
    if (event.fraudScore > threshold) {
      return { ok: false, reason: 'fraud_score_too_high' };
    }

    // 3. Per-user rate limit (sliding 1-second bucket)
    const rateKey = `${app.id}:${event.externalUserId}`;
    if (this.exceedsRate(rateKey, now, DEFAULT_RATE_LIMIT_PER_SEC)) {
      return { ok: false, reason: 'rate_limit_exceeded' };
    }

    // 4. SDK version blacklist
    const sdkVersion =
      typeof event.payload?.sdkVersion === 'string'
        ? (event.payload.sdkVersion as string)
        : undefined;
    if (sdkVersion && !this.isVersionAllowed(sdkVersion)) {
      return { ok: false, reason: 'sdk_version_blacklisted' };
    }

    return { ok: true };
  }

  private resolveFraudThreshold(app: Application): number {
    const candidate = (app as unknown as { botRejectThreshold?: number })
      .botRejectThreshold;
    return typeof candidate === 'number' && candidate > 0 && candidate <= 1
      ? candidate
      : DEFAULT_FRAUD_THRESHOLD;
  }

  private exceedsRate(key: string, nowMs: number, limit: number): boolean {
    const second = Math.floor(nowMs / 1000);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.windowStart !== second) {
      this.buckets.set(key, { count: 1, windowStart: second });
      this.maybeCleanup(second);
      return false;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      return true;
    }
    return false;
  }

  private maybeCleanup(currentSecond: number) {
    if (this.buckets.size < 10_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.windowStart < currentSecond - 5) {
        this.buckets.delete(key);
      }
    }
  }

  private isVersionAllowed(version: string): boolean {
    if (!semver.valid(version)) {
      this.logger.warn(`Non-semver SDK version received: ${version}`);
      return true; // don't block on parse errors
    }
    return semver.gte(version, this.minSdkVersion);
  }
}
