'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';
import {
  Home,
  Wallet,
  ShoppingBag,
  Code,
  BarChart3,
  Users,
  Settings,
  Link as LinkIcon,
  Database,
  CreditCard,
  LogOut,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: Home,
    roles: ['user', 'developer', 'buyer', 'admin'],
  },
  {
    href: '/dashboard/wallet',
    label: 'My Wallet',
    icon: Wallet,
    roles: ['user', 'developer', 'buyer'],
  },
  {
    href: '/dashboard/apps',
    label: 'Browse Apps',
    icon: LinkIcon,
    roles: ['user'],
  },
  {
    href: '/dashboard/my-apps',
    label: 'My Apps',
    icon: Code,
    roles: ['developer'],
  },
  {
    href: '/dashboard/data-products',
    label: 'Data Products',
    icon: Database,
    roles: ['developer'],
  },
  {
    href: '/dashboard/api-keys',
    label: 'API Keys',
    icon: Settings,
    roles: ['developer'],
  },
  {
    href: '/dashboard/campaigns',
    label: 'Campaigns',
    icon: ShoppingBag,
    roles: ['buyer'],
  },
  {
    href: '/dashboard/marketplace',
    label: 'Marketplace',
    icon: Database,
    roles: ['buyer'],
  },
  {
    href: '/dashboard/admin/users',
    label: 'Users',
    icon: Users,
    roles: ['admin'],
  },
  {
    href: '/dashboard/admin/transactions',
    label: 'All Transactions',
    icon: CreditCard,
    roles: ['admin'],
  },
  {
    href: '/dashboard/admin/analytics',
    label: 'Analytics',
    icon: BarChart3,
    roles: ['admin'],
  },
  {
    href: '/dashboard/admin/reports',
    label: 'Reports',
    icon: FileText,
    roles: ['admin'],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(user.role)
  );

  const roleLabels: Record<UserRole, string> = {
    user: 'End User',
    developer: 'Developer',
    buyer: 'Buyer',
    admin: 'Admin',
  };

  return (
    <aside className="w-64 border-r bg-card min-h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">🎅 DataClaus</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {roleLabels[user.role]} Portal
        </p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="mb-3">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
