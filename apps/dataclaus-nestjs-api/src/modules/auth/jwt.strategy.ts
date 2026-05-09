import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtPayload } from './dto';

/** Cookie name for the access token (httpOnly). Must match auth.controller.ts. */
const SESSION_COOKIE_NAME = 'dc_session';

/**
 * Extracts the access token from a Cookie first, then falls back to the
 * Authorization header. We list the cookie extractor first so a stale
 * Bearer token in the header (left over from localStorage during a
 * mid-rollout transition) does not preempt the fresh cookie-managed
 * session.
 */
function cookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (cookies && cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'default-secret',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    // Refresh tokens may not be presented to protected routes.
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Refresh token cannot access this route');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
