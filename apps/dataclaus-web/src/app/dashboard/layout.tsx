'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { TourProvider, OnboardingModal, HelpTriggerBadge } from '@/components/ui/onboarding-tour';

// Preload critical routes for faster navigation
const preloadRoutes = [
  '/dashboard',
  '/dashboard/my-apps',
  '/dashboard/api-keys',
  '/dashboard/docs',
  '/dashboard/wallet',
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/');
      return;
    }
    if (user.role === 'user') {
      router.push('/u/dashboard');
    }
  }, [user, isLoading, router]);

  // Preload routes on mount for faster navigation
  useEffect(() => {
    if (user) {
      preloadRoutes.forEach(route => {
        router.prefetch(route);
      });
    }
  }, [user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <TourProvider>
      <div className="flex min-h-screen bg-slate-50 relative overflow-hidden">
        {/* Background (Shared with LOGIN aesthetics) */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-100/60 rounded-full blur-[120px] animate-float opacity-60"></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[100px] animate-float-delayed"></div>
          
          {/* Subtle Grid Overlay */}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.3]"></div>
        </div>

        <Sidebar />
        
        <main className="flex-1 p-8 z-10 overflow-auto relative">
          {children}
        </main>

        {/* Onboarding Tour Components - Now use portals, so they render at document.body level */}
        <OnboardingModal />
        <HelpTriggerBadge />
      </div>
    </TourProvider>
  );
}
