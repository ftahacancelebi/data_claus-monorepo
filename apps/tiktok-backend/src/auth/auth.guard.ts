/**
 * Auth Guard
 *
 * Verifies JWT tokens via the Go API.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = process.env.DATACLAUS_API_URL || 'http://localhost:3000';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const response = await fetch(`${this.apiUrl}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      const responseBody = await response.json();
      const user = responseBody.data || responseBody;

      // Validate user structure just in case
      if (!user || !user.id) {
        throw new Error('Invalid user profile response');
      }

      request.user = user;
      request.token = token;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid token');
    }
  }
}
