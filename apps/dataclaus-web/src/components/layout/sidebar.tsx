'use client';

import Link from 'next/link';
import Image from 'next/image';
import Logo from '../../assets/logos/logo.svg';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';
import {
  House,
  Wallet,
  Storefront,
  Code,
  ChartBar,
  Users,
  ShieldCheck,
  Database,
  CreditCard,
  SignOut,
  FileText,
  TrendUp,
  User,
  Book,
  Question
} from 'phosphor-react';
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
    label: 'Overview',
    icon: House,
    roles: ['user', 'developer', 'buyer', 'admin'],
  },
  {
    href: '/dashboard/wallet',
    label: 'Finances',
    icon: Wallet,
    roles: ['user', 'developer', 'buyer'],
  },
  {
    href: '/dashboard/apps',
    label: 'App Store',
    icon: Storefront,
    roles: ['user'],
  },
  {
    href: '/dashboard/my-apps',
    label: 'Applications',
    icon: Code,
    roles: ['developer'],
  },
  {
    href: '/dashboard/docs',
    label: 'SDK Docs',
    icon: Book,
    roles: ['developer'],
  },
  {
    href: '/dashboard/faq',
    label: 'Help & FAQ',
    icon: Question,
    roles: ['developer', 'buyer', 'user'],
  },
  {
    href: '/dashboard/campaigns',
    label: 'Campaigns',
    icon: TrendUp,
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
    label: 'Transactions',
    icon: CreditCard,
    roles: ['admin'],
  },
  {
    href: '/dashboard/admin/analytics',
    label: 'Analytics',
    icon: ChartBar,
    roles: ['admin'],
  },
  {
    href: '/dashboard/admin/reports',
    label: 'System Reports',
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

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-center mb-4">
  <Image src={Logo} alt="DataClaus Logo" width={48} height={48} className="w-28 h-auto" />
</div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold pl-10">
             {user.role} Workspace
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
              )}
            >
              <Icon 
                size={18} 
                weight={isActive ? "fill" : "duotone"} 
                className={cn('transition-colors', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600')} 
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Profile */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 mb-4">
             <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                <User weight="duotone" size={18} />
             </div>
             <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
             </div>
        </div>
        
        <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            onClick={logout}
        >
          <SignOut className="h-4 w-4 mr-2" weight="bold" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
