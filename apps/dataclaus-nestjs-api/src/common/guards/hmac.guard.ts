import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class HmacGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const signature = request.headers['x-signature'] as string;
    const timestamp = request.headers['x-timestamp'] as string;
    const apiKey = request.headers['x-api-key'] as string;

    if (!signature || !timestamp || !apiKey) {
      throw new UnauthorizedException(
        'Missing required HMAC headers: x-signature, x-timestamp, x-api-key',
      );
    }

    // Check timestamp freshness (5 minutes window)
    const requestTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - requestTime);

    if (timeDiff > 300) {
      throw new UnauthorizedException('Request timestamp expired');
    }

    // For now, we store the API key in the request for the controller to validate
    // The actual signature validation will be done in the service with the secret
    (request as any)['hmacData'] = {
      signature,
      timestamp,
      apiKey,
    };

    return true;
  }

  static validateSignature(
    secret: string,
    method: string,
    path: string,
    timestamp: string,
    body: string,
    providedSignature: string,
  ): boolean {
    const message = `${method}|${path}|${timestamp}|${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature),
    );
  }
}
