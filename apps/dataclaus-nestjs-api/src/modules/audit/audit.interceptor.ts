import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request } from 'express';
import { AuditService } from './audit.service';
import {
  AUDIT_ACTION_METADATA,
  AuditOptions,
} from './audit.decorator';
import { AuditActorType } from './entities/audit-log.entity';

interface AuthedUser {
  id?: string;
  role?: string;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditOptions>(
      AUDIT_ACTION_METADATA,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request & { user?: AuthedUser }>();
    const actor = this.resolveActor(req);
    const targetId = this.resolveTargetId(req, options);
    const ipAddress = this.resolveIp(req);
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null;

    const baseContext: Record<string, unknown> = {
      method: req.method,
      path: req.originalUrl ?? req.url,
    };

    return next.handle().pipe(
      tap((response) => {
        void this.auditService.record({
          actorType: actor.type,
          actorId: actor.id,
          action: options.action,
          targetType: options.targetType ?? null,
          targetId,
          ipAddress,
          userAgent,
          status: 200,
          context: {
            ...baseContext,
            // Only persist a small fingerprint of the response, never the
            // full body (may include secrets like rotated raw_key).
            responseShape: this.summarize(response),
          },
        });
      }),
      catchError((err) => {
        void this.auditService.record({
          actorType: actor.type,
          actorId: actor.id,
          action: options.action,
          targetType: options.targetType ?? null,
          targetId,
          ipAddress,
          userAgent,
          status: typeof (err as { status?: number }).status === 'number'
            ? (err as { status: number }).status
            : 500,
          errorMessage: ((err as Error).message ?? '').slice(0, 500),
          context: baseContext,
        });
        return throwError(() => err);
      }),
    );
  }

  private resolveActor(
    req: Request & { user?: AuthedUser },
  ): { type: AuditActorType; id: string } {
    const user = req.user;
    if (user?.id) {
      const role = (user.role ?? 'user').toLowerCase();
      const type =
        role === 'admin' || role === 'developer' || role === 'buyer' || role === 'user'
          ? (role as AuditActorType)
          : 'user';
      return { type, id: user.id };
    }
    const hmac = (req as unknown as { hmacContext?: { developerId: string } })
      .hmacContext;
    if (hmac?.developerId) {
      return { type: 'developer', id: hmac.developerId };
    }
    return { type: 'anonymous', id: 'anonymous' };
  }

  private resolveTargetId(
    req: Request,
    options: AuditOptions,
  ): string | null {
    if (!options.targetIdParam) return null;
    const params = req.params as Record<string, string | undefined>;
    return params[options.targetIdParam] ?? null;
  }

  private resolveIp(req: Request): string | null {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? null;
  }

  private summarize(response: unknown): Record<string, unknown> {
    if (!response || typeof response !== 'object') {
      return { type: typeof response };
    }
    const keys = Object.keys(response as Record<string, unknown>);
    return { keys: keys.slice(0, 12) };
  }
}
