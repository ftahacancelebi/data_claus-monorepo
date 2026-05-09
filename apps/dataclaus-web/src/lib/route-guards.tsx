'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import type { UserRole } from './types';

interface FullPageSpinnerProps {
  label?: string;
}

function FullPageSpinner({ label }: FullPageSpinnerProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        {label ? (
          <p className="text-sm text-slate-500 font-medium">{label}</p>
        ) : null}
      </div>
    </div>
  );
}

interface RequireAuthProps {
  children: ReactNode;
  /** Where to send unauth'd users. Default: '/'. */
  redirectTo?: string;
  /** Optional label shown while AuthProvider hydrates. */
  loadingLabel?: string;
}

/**
 * Renders children only when the user is authenticated.
 *
 * State machine:
 * - status === 'unknown'  → render skeleton; do NOT redirect (would bounce
 *                           a logged-in user on hard refresh).
 * - status === 'guest'    → redirect to `redirectTo`, render skeleton during
 *                           the navigation tick.
 * - status === 'authed'   → render children.
 */
export function RequireAuth({
  children,
  redirectTo = '/',
  loadingLabel,
}: RequireAuthProps) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'guest') {
      router.replace(redirectTo);
    }
  }, [status, redirectTo, router]);

  if (status !== 'authed') {
    return <FullPageSpinner label={loadingLabel} />;
  }

  return <>{children}</>;
}

interface RequireRoleProps {
  children: ReactNode;
  /** One or more allowed roles. */
  role: UserRole | UserRole[];
  /** Where to send users with the wrong role. Default: '/dashboard'. */
  redirectTo?: string;
  /** Where to send unauth'd users (no `user`). Default: '/'. */
  unauthRedirectTo?: string;
  /** Optional label shown while AuthProvider hydrates. */
  loadingLabel?: string;
}

/**
 * Gates a subtree to one or more roles. Use to wrap admin/* and similar.
 *
 * Behavior:
 * - status === 'unknown'                       → skeleton.
 * - status === 'guest'                         → redirect to `unauthRedirectTo`.
 * - status === 'authed' && role mismatch       → redirect to `redirectTo`,
 *                                                 render skeleton during the tick.
 * - status === 'authed' && role match          → render children.
 *
 * Note: this is *client-side* gating. A determined user can still see the
 * shell flash before redirect. Server-side gating requires the cookie/middleware
 * migration tracked separately.
 */
export function RequireRole({
  children,
  role,
  redirectTo = '/dashboard',
  unauthRedirectTo = '/',
  loadingLabel,
}: RequireRoleProps) {
  const { status, user } = useAuth();
  const router = useRouter();

  const allowed = Array.isArray(role) ? role : [role];

  useEffect(() => {
    if (status === 'guest') {
      router.replace(unauthRedirectTo);
      return;
    }
    if (status === 'authed' && user && !allowed.includes(user.role)) {
      router.replace(redirectTo);
    }
    // We intentionally exclude `allowed` from deps to avoid effect churn
    // from a fresh array on every render; serialize via JSON.stringify-style
    // primitive instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.role, redirectTo, unauthRedirectTo, router]);

  if (status === 'unknown') {
    return <FullPageSpinner label={loadingLabel} />;
  }
  if (status === 'guest') {
    return <FullPageSpinner label={loadingLabel} />;
  }
  if (!user || !allowed.includes(user.role)) {
    return <FullPageSpinner label={loadingLabel} />;
  }
  return <>{children}</>;
}
