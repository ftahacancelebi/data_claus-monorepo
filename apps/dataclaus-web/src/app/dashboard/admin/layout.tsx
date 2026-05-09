'use client';

import { ReactNode } from 'react';
import { RequireRole } from '@/lib/route-guards';

/**
 * Admin sub-tree gate.
 *
 * The parent `dashboard/layout.tsx` already enforces auth + bounces user-role
 * accounts to /u/dashboard. This nested layout adds the role check: only
 * `admin` may render anything under /dashboard/admin/*. Anyone else is
 * redirected to /dashboard.
 *
 * Server-side gating still belongs in middleware; this is the client-side
 * floor that prevents the shell from rendering at all (no more "developer
 * sees admin shell with silent zeros" bug).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole
      role="admin"
      redirectTo="/dashboard"
      loadingLabel="Checking admin access…"
    >
      {children}
    </RequireRole>
  );
}
