'use client';

import { RequireRole } from '@/lib/route-guards';
import { UserSidebar } from '@/components/user/UserSidebar';
import { UserOnboardingTour } from '@/components/user/UserOnboardingTour';

function UserShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-100/60 rounded-full blur-[120px] animate-float opacity-60" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[100px] animate-float-delayed" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.3]" />
      </div>

      <UserSidebar />
      <main className="flex-1 p-8 z-10 overflow-auto relative">
        {children}
      </main>
      <UserOnboardingTour />
    </div>
  );
}

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole
      role="user"
      redirectTo="/dashboard"
      unauthRedirectTo="/"
      loadingLabel="Loading your earnings…"
    >
      <UserShell>{children}</UserShell>
    </RequireRole>
  );
}
