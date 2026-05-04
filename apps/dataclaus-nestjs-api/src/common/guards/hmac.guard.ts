import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  RawBodyRequest,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import * as crypto from 'crypto';
import { ApiKey } from '../../modules/developer/entities';

export interface HmacContext {
  applicationId: string | null;
  developerId: string;
  apiKeyId: string;
}

const HMAC_TIMESTAMP_WINDOW_SECONDS = 300; // ±5 min

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();

    const signature = req.headers['x-signature'] as string | undefined;
    const timestamp = req.headers['x-timestamp'] as string | undefined;
    const apiKeyValue = req.headers['x-api-key'] as string | undefined;

    if (!signature || !timestamp || !apiKeyValue) {
      throw new UnauthorizedException(
        'Missing required HMAC headers: x-signature, x-timestamp, x-api-key',
      );
    }

    // Timestamp window check (±5 min)
    const requestTime = parseInt(timestamp, 10);
    if (!Number.isFinite(requestTime)) {
      throw new UnauthorizedException('Invalid x-timestamp header');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - requestTime) > HMAC_TIMESTAMP_WINDOW_SECONDS) {
      throw new UnauthorizedException('Request timestamp expired or skewed');
    }

    // Lookup ApiKey by hash of provided value
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKeyValue)
      .digest('hex');
    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash, isActive: true },
    });
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Compute signature on canonical message: METHOD|PATH|TIMESTAMP|RAW_BODY
    const rawBody = (req.rawBody ?? Buffer.from('')).toString('utf8');
    const originalUrl = (req as unknown as { originalUrl?: string })
      .originalUrl;
    const path = originalUrl
      ? new URL(originalUrl, 'http://internal').pathname
      : req.path;
    const message = `${req.method.toUpperCase()}|${path}|${timestamp}|${rawBody}`;

    // The shared HMAC secret IS the apiKey value (matches SDK behaviour)
    const expected = crypto
      .createHmac('sha256', apiKeyValue)
      .update(message)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(signature, 'utf8');
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException('Invalid HMAC signature');
    }

    // Fire-and-forget lastUsedAt update
    this.apiKeyRepo
      .update({ id: apiKey.id }, { lastUsedAt: new Date() })
      .catch(() => undefined);

    const ctx: HmacContext = {
      applicationId: apiKey.applicationId,
      developerId: apiKey.developerId,
      apiKeyId: apiKey.id,
    };
    (req as unknown as { hmacContext: HmacContext }).hmacContext = ctx;

    return true;
  }

  /**
   * Static helper exposed for SDKs and tests.
   * Canonical message format: METHOD|PATH|TIMESTAMP|RAW_BODY
   */
  static computeSignature(
    apiKey: string,
    method: string,
    path: string,
    timestamp: string,
    rawBody: string,
  ): string {
    const message = `${method.toUpperCase()}|${path}|${timestamp}|${rawBody}`;
    return crypto.createHmac('sha256', apiKey).update(message).digest('hex');
  }
}
