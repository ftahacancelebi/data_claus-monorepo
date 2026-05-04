'use client';

import Link from 'next/link';
import Image from 'next/image';
import Logo from '../../assets/logos/logo.svg';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import {
  House,
  Wallet,
  ChartBar,
  Receipt,
  Star,
  ArrowSquareOut,
  ShieldCheck,
  User,
  SignOut,
  DeviceMobile,
} from 'phosphor-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
}

const items: NavItem[] = [
  { href: '/u/dashboard', label: 'Overview', icon: House, exact: true },
  { href: '/u/earnings', label: 'Earnings', icon: ChartBar, exact: true },
  { href: '/u/earnings/by-app', label: '· By app', icon: Receipt },
  { href: '/u/earnings/history', label: '· History', icon: Receipt },
  { href: '/u/earnings/quality', label: '· Quality', icon: Star },
  { href: '/u/withdraw', label: 'Withdraw', icon: Wallet },
  { href: '/u/sessions', label: 'Sessions', icon: DeviceMobile },
  { href: '/u/account', label: 'Account', icon: User },
];

export function UserSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-center mb-4">
          <Image
            src={Logo}
            alt="DataClaus"
            width={48}
            height={48}
            className="w-28 h-auto"
          />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold pl-10">
          End-user portal
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent',
              )}
            >
              <Icon
                size={18}
                weight={isActive ? 'fill' : 'duotone'}
                className={cn(
                  'transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-slate-400 group-hover:text-slate-600',
                )}
              />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-slate-100">
          <Link
            href="/legal/privacy"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-700"
          >
            <ShieldCheck size={14} weight="duotone" />
            Privacy & data rights
            <ArrowSquareOut size={12} className="ml-auto" />
          </Link>
        </div>
      </nav>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
            <User weight="duotone" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">
              {user.name}
            </p>
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
