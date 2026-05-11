import { NextResponse } from 'next/server';

/**
 * MVP: middleware is a no-op pass-through.
 *
 * Why this is a no-op:
 *   The previous version gated `/dashboard/*` and `/u/*` on the `dc_session`
 *   httpOnly cookie. That cookie had a short TTL while the localStorage
 *   access token (which is the real auth source the frontend reads) lived
 *   much longer. When the cookie expired first the middleware redirected to
 *   `/`, the login page hydrated from localStorage and bounced the user back
 *   to `/dashboard`, producing an infinite redirect loop and a stuck
 *   loading spinner.
 *
 *   For the MVP we trust the client-side AuthProvider + the API guard
 *   (NestJS JwtAuthGuard returns 401 on any bad/missing token) as the
 *   security boundary. Server-side route gating can be reintroduced once
 *   the cookie ↔ token lifetimes are unified and the frontend reads auth
 *   state from the cookie too.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  // Run on nothing — keep the file so Next.js still picks it up, but skip the
  // edge cost everywhere. (An empty matcher is the recommended way to disable
  // middleware without deleting the file and breaking deploy configs.)
  matcher: [],
};
