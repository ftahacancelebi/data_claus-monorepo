'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import {
  getWalletsByOwner,
  getDashboard,
  type DashboardStats,
} from '@/lib/api';
import type { Wallet } from '@/lib/types';
import { formatMoney, REVENUE_SHARES } from '@/lib/types';
import { Database, DollarSign, Users, Info } from 'lucide-react';
import Link from 'next/link';

export default function DataProductsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [walletsData, statsData] = await Promise.all([
          getWalletsByOwner(user.id).catch(() => []),
          getDashboard().catch(() => null),
        ]);
        setWallets(walletsData);
        setStats(statsData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (!user) return null;

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const pendingBalance = wallets.reduce(
    (sum, w) => sum + (w.pending_balance || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Products</h1>
        <p className="text-muted-foreground">
          Earn from data collected through your apps
        </p>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How Developer Earnings Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            As a developer, you can configure how much users earn (
            <strong>
              {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
              {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}%
            </strong>
            ). Higher user share attracts more users! Platform takes a fixed{' '}
            {REVENUE_SHARES.PLATFORM_FEE_PERCENT}%.
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-3 text-sm">
            <div className="p-3 bg-white rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">
                {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
                {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}%
              </p>
              <p className="text-muted-foreground">To Users (you set)</p>
            </div>
            <div className="p-3 bg-white rounded-lg text-center border-2 border-blue-300">
              <p className="text-2xl font-bold text-blue-600">5-45%</p>
              <p className="text-muted-foreground">To You (remainder)</p>
            </div>
            <div className="p-3 bg-white rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-600">
                {REVENUE_SHARES.PLATFORM_FEE_PERCENT}%
              </p>
              <p className="text-muted-foreground">Platform (fixed)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Your Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totalBalance, 2)}
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
            <CardTitle className="text-sm font-medium">
              Platform Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_users ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Potential data providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.total_events ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Data points collected
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Steps to start earning from your apps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-start p-4 border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Create API Keys</p>
                <p className="text-sm text-muted-foreground">
                  Generate API keys to authenticate your app&apos;s data
                  submissions
                </p>
                <Link href="/dashboard/api-keys">
                  <Button size="sm" variant="outline" className="mt-2">
                    Manage API Keys
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Integrate SDK</p>
                <p className="text-sm text-muted-foreground">
                  Use our SDK to collect and submit quality data from your app
                </p>
                <Link href="/dashboard/my-apps">
                  <Button size="sm" variant="outline" className="mt-2">
                    View My Apps
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Earn Automatically</p>
                <p className="text-sm text-muted-foreground">
                  When buyers run campaigns, you automatically earn your
                  configured share of the revenue generated through your
                  app&apos;s users
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Earnings Formula</CardTitle>
          <CardDescription>How your earnings are calculated</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted rounded-lg font-mono text-sm">
            <p>Total Revenue = Quality Score × Active Time × Campaign Rate</p>
            <p className="mt-2 text-muted-foreground">
              Distribution (you configure user share from{' '}
              {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
              {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}%):
            </p>
            <p className="mt-1">User Payout = Total × User Share %</p>
            <p className="mt-1">
              Your Share = Total × (100% - {REVENUE_SHARES.PLATFORM_FEE_PERCENT}
              % - User Share %)
            </p>
            <p className="mt-1">
              Platform Fee = Total × {REVENUE_SHARES.PLATFORM_FEE_PERCENT}%
            </p>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Higher user share attracts more users but reduces your cut. Find the
            right balance! Amounts below{' '}
            {formatMoney(REVENUE_SHARES.MIN_PAYOUT_THRESHOLD, 2)} are held as
            pending.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
