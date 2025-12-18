'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Code,
  Activity,
  DollarSign,
  Target,
  BarChart3,
} from 'lucide-react';
import type { DashboardStats } from '@/lib/api';

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Events',
      value: stats?.total_events ?? 0,
      icon: Activity,
      format: (v: number) => v.toLocaleString(),
    },
    {
      title: 'Total Users',
      value: stats?.total_users ?? 0,
      icon: Users,
      format: (v: number) => v.toLocaleString(),
    },
    {
      title: 'Developers',
      value: stats?.total_developers ?? 0,
      icon: Code,
      format: (v: number) => v.toLocaleString(),
    },
    {
      title: 'Avg Quality',
      value: stats?.average_quality ?? 0,
      icon: BarChart3,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
    },
    {
      title: 'Total Payouts',
      value: stats?.total_payouts ?? 0,
      icon: DollarSign,
      format: (v: number) => `$${v.toLocaleString()}`,
    },
    {
      title: 'Active Campaigns',
      value: stats?.active_campaigns ?? 0,
      icon: Target,
      format: (v: number) => v.toLocaleString(),
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : card.format(card.value)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
