import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export interface SignedPayload<T extends Record<string, unknown>> {
  payload: T;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

export interface VerifyOptions {
  maxAgeMs?: number;
  expectedAudience?: string;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const NONCE_RETENTION_MS = 10 * 60 * 1000;

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);
  private readonly secret: Buffer;
  private readonly nonces = new Map<string, number>();
  private lastSweep = Date.now();

  constructor(private readonly config: ConfigService) {
    const secret =
      this.config.get<string>('AD_SIGNING_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'dataclaus-dev-only-secret-do-not-use-in-prod';

    if (secret.length < 32) {
      this.logger.warn(
        'AD_SIGNING_SECRET is shorter than 32 chars — set a stronger secret in production',
      );
    }
    this.secret = Buffer.from(secret, 'utf8');
  }

  sign<T extends Record<string, unknown>>(
    payload: T,
    ttlMs: number = DEFAULT_TTL_MS,
  ): SignedPayload<T> {
    const now = Date.now();
    const nonce = randomBytes(16).toString('hex');
    const envelope = {
      payload,
      nonce,
      issuedAt: now,
      expiresAt: now + ttlMs,
    };

    const signature = this.computeSignature(envelope);
    return { ...envelope, signature };
  }

  verify<T extends Record<string, unknown>>(
    signed: SignedPayload<T>,
    opts: VerifyOptions = {},
  ): T {
    if (!signed || typeof signed !== 'object') {
      throw new UnauthorizedException('Invalid signed payload');
    }
    const { payload, nonce, issuedAt, expiresAt, signature } = signed;
    if (!payload || !nonce || !signature || !issuedAt || !expiresAt) {
      throw new UnauthorizedException('Malformed signed payload');
    }

    const expected = this.computeSignature({
      payload,
      nonce,
      issuedAt,
      expiresAt,
    });
    if (!this.constantTimeEqual(signature, expected)) {
      throw new UnauthorizedException('Signature mismatch');
    }

    const now = Date.now();
    if (now > expiresAt) {
      throw new UnauthorizedException('Signed payload expired');
    }
    if (opts.maxAgeMs && now - issuedAt > opts.maxAgeMs) {
      throw new UnauthorizedException('Signed payload too old');
    }

    this.assertNonceFresh(nonce, expiresAt);
    return payload;
  }

  encode<T extends Record<string, unknown>>(signed: SignedPayload<T>): string {
    return Buffer.from(JSON.stringify(signed), 'utf8').toString('base64url');
  }

  decode<T extends Record<string, unknown>>(token: string): SignedPayload<T> {
    try {
      const json = Buffer.from(token, 'base64url').toString('utf8');
      return JSON.parse(json) as SignedPayload<T>;
    } catch {
      throw new UnauthorizedException('Malformed token');
    }
  }

  signToken<T extends Record<string, unknown>>(
    payload: T,
    ttlMs?: number,
  ): string {
    return this.encode(this.sign(payload, ttlMs));
  }

  verifyToken<T extends Record<string, unknown>>(
    token: string,
    opts?: VerifyOptions,
  ): T {
    return this.verify<T>(this.decode<T>(token), opts);
  }

  hmacHex(input: string): string {
    return createHmac('sha256', this.secret).update(input).digest('hex');
  }

  private computeSignature(envelope: {
    payload: Record<string, unknown>;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
  }): string {
    const canonical = JSON.stringify({
      payload: this.canonicalize(envelope.payload),
      nonce: envelope.nonce,
      issuedAt: envelope.issuedAt,
      expiresAt: envelope.expiresAt,
    });
    return createHmac('sha256', this.secret).update(canonical).digest('hex');
  }

  private canonicalize(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((v) => this.canonicalize(v));
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = this.canonicalize(obj[key]);
    }
    return sorted;
  }

  private constantTimeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }

  private assertNonceFresh(nonce: string, expiresAt: number): void {
    this.sweepNonces();
    if (this.nonces.has(nonce)) {
      throw new UnauthorizedException('Replay detected: nonce already used');
    }
    this.nonces.set(nonce, expiresAt + NONCE_RETENTION_MS);
  }

  private sweepNonces(): void {
    const now = Date.now();
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [n, expiry] of this.nonces) {
      if (expiry < now) this.nonces.delete(n);
    }
  }
}
