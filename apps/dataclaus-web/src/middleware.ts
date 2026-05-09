import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side route gate.
 *
 * Reads the `dc_session` httpOnly cookie that the API sets on login. If the
 * cookie is missing on a protected path, redirects to `/` (login page) BEFORE
 * any client-side React tree renders. This eliminates the brief flash of the
 * dashboard layout that the old client-only `useEffect` redirect produced on
 * hard refresh, and prevents direct-URL access from leaking the layout shell.
 *
 * Notes:
 *   - We deliberately do NOT verify the JWT signature here. Verification is
 *     enforced by the NestJS JwtAuthGuard on every API call. Middleware only
 *     answers "is there a session?" — a tampered cookie would still 401 on
 *     every API call, which the AuthProvider hydration step (and the
 *     api-hooks error UX) handles.
 *   - Role-based gating (admin) is still client-side via <RequireRole> until
 *     the cookie is upgraded to also carry the role claim or we exchange a
 *     short JWT verification on the edge.
 *   - The `/auth/*` API routes are excluded so login itself can mint the
 *     cookie.
 */

const PROTECTED_PATH_PREFIXES = ['/dashboard', '/u'];
const SESSION_COOKIE_NAME = 'dc_session';

function isProtected(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE_NAME);
  if (session?.value) {
    return NextResponse.next();
  }

  // No session → redirect to login. Preserve the intended destination
  // so the login page can bounce the user back after auth.
  const loginUrl = new URL('/', request.url);
  if (pathname !== '/') {
    loginUrl.searchParams.set('next', `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

/**
 * Run middleware on protected segments only. Keep the matcher narrow so we
 * don't pay the edge cost on `/api/*` (Next rewrite passthrough), assets,
 * `/_next/*`, `/legal/*` (public), or the login page itself.
 */
export const config = {
  matcher: ['/dashboard/:path*', '/u/:path*'],
};
