import { SetMetadata } from '@nestjs/common';

export const AUDIT_ACTION_METADATA = 'AUDIT_ACTION_METADATA';

export interface AuditOptions {
  /** Dotted action path, e.g. `developer.api_key.rotated`. */
  action: string;
  /** Optional: which path/body field identifies the target object. */
  targetIdParam?: string;
  /** Optional: target type label (e.g. `api_key`, `payout`). */
  targetType?: string;
}

/**
 * Mark an HTTP handler so the AuditInterceptor records its invocation.
 * Place above the @Post / @Patch / etc. decorator:
 *
 * ```
 * @AuditAction({ action: 'developer.api_key.rotated', targetIdParam: 'keyId' })
 * @Post(':id/api-keys/:keyId/rotate')
 * ```
 */
export const AuditAction = (options: AuditOptions) =>
  SetMetadata(AUDIT_ACTION_METADATA, options);
