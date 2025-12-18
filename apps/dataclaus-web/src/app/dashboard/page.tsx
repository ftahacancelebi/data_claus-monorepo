'use client';

import { useAuth } from '@/lib/auth-context';
import { UserDashboard } from '@/components/dashboards/user-dashboard';
import { DeveloperDashboard } from '@/components/dashboards/developer-dashboard';
import { BuyerDashboard } from '@/components/dashboards/buyer-dashboard';
import { AdminDashboard } from '@/components/dashboards/admin-dashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'user':
      return <UserDashboard user={user} />;
    case 'developer':
      return <DeveloperDashboard user={user} />;
    case 'buyer':
      return <BuyerDashboard user={user} />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <div>Unknown role</div>;
  }
}
