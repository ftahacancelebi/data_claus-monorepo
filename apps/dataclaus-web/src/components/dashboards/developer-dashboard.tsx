'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AuthUser, Wallet, ApiKey } from '@/lib/types';
import { formatMoney, REVENUE_SHARES } from '@/lib/types';
import {
  getWalletsByOwner,
  listApiKeys,
  getDashboard,
  type DashboardStats,
} from '@/lib/api';
import {
  DollarSign,
  Users,
  Activity,
  Key,
  TrendingUp,
  Settings,
} from 'lucide-react';

interface Props {
  user: AuthUser;
}

export function DeveloperDashboard({ user }: Props) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletsData, keysData, statsData] = await Promise.all([
          getWalletsByOwner(user.id).catch(() => []),
          listApiKeys(user.id).catch(() => []),
          getDashboard().catch(() => null),
        ]);
        setWallets(walletsData);
        setApiKeys(keysData);
        setStats(statsData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const pendingBalance = wallets.reduce(
    (sum, w) => sum + (w.pending_balance || 0),
    0
  );
  const activeKeys = apiKeys.filter((k) => k.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Developer Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your apps, data products, and earnings
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatMoney(totalBalance, 2)}
            </div>
            {pendingBalance > 0 && (
              <p className="text-xs text-muted-foreground">
                +{formatMoney(pendingBalance, 6)} pending
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Your Share</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5-45%</div>
            <p className="text-xs text-muted-foreground">
              Per app (configurable)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_users ?? 0}</div>
            <p className="text-xs text-muted-foreground">Using your apps</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeKeys}</div>
            <p className="text-xs text-muted-foreground">Active keys</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Revenue Sharing
            </CardTitle>
            <CardDescription>
              Each app has its own user share setting. Configure in My Apps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span>Users get</span>
                  <Badge variant="default" className="bg-green-600">
                    {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
                    {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}%
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span>You get</span>
                  <Badge variant="secondary">5-45%</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span>Platform (fixed)</span>
                  <Badge variant="outline">
                    {REVENUE_SHARES.PLATFORM_FEE_PERCENT}%
                  </Badge>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => (window.location.href = '/dashboard/my-apps')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure App Revenue Shares
              </Button>

              <p className="text-sm text-muted-foreground">
                💡 Tip: Higher user share makes your app more attractive in the
                marketplace! Set it per-app in My Apps.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Platform Stats
            </CardTitle>
            <CardDescription>Overall platform metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span>Total Events</span>
              <span className="font-bold">
                {stats?.total_events?.toLocaleString() ?? 0}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span>Avg Quality Score</span>
              <span className="font-bold">
                {stats?.average_quality
                  ? `${(stats.average_quality * 100).toFixed(1)}%`
                  : '0%'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span>Total Payouts</span>
              <span className="font-bold">
                {formatMoney(stats?.total_payouts ?? 0, 2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
