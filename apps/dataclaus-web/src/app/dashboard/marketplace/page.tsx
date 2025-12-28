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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { getDashboard, type DashboardStats } from '@/lib/api';
import { formatMoney, REVENUE_SHARES } from '@/lib/types';
import { Search, Database, Users, BarChart3, Info } from 'lucide-react';
import Link from 'next/link';

export default function MarketplacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getDashboard().catch(() => null);
        setStats(data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (!user) return null;

  // Data categories available through campaigns
  const dataCategories = [
    {
      name: 'User Engagement Data',
      description: 'Screen time, app usage patterns, interaction quality',
      users: stats?.total_users ?? 0,
      avgQuality: stats?.average_quality ?? 0,
      events: stats?.total_events ?? 0,
    },
    {
      name: 'Behavioral Analytics',
      description: 'User behavior patterns and preferences',
      users: Math.floor((stats?.total_users ?? 0) * 0.8),
      avgQuality: (stats?.average_quality ?? 0) * 0.95,
      events: Math.floor((stats?.total_events ?? 0) * 0.6),
    },
    {
      name: 'Quality Verified Data',
      description: 'Human-verified, high quality score data only',
      users: Math.floor((stats?.total_users ?? 0) * 0.3),
      avgQuality: 0.95,
      events: Math.floor((stats?.total_events ?? 0) * 0.2),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Marketplace</h1>
        <p className="text-muted-foreground">
          Access quality user data through campaigns
        </p>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Instead of buying data directly, you create{' '}
            <strong>campaigns</strong> that pay users for their data in
            real-time. This ensures fresh, quality data while fairly
            compensating users.
          </p>
          <div className="mt-4 grid gap-2 md:grid-cols-3 text-sm">
            <div className="p-3 bg-white rounded-lg">
              <p className="font-medium">1. Create Campaign</p>
              <p className="text-muted-foreground">
                Set your budget and targeting
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="font-medium">2. Users Earn</p>
              <p className="text-muted-foreground">
                Quality data = higher earnings
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="font-medium">3. Get Insights</p>
              <p className="text-muted-foreground">
                Access real-time analytics
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/campaigns">
              <Button>Create a Campaign</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search data categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : (stats?.total_users ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Available data providers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Quality Score
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading
                ? '...'
                : `${((stats?.average_quality ?? 0) * 100).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">Platform average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : (stats?.total_events ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Data points collected
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        {dataCategories
          .filter((cat) =>
            cat.name.toLowerCase().includes(search.toLowerCase())
          )
          .map((category) => (
            <Card key={category.name}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{category.name}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Users</p>
                    <p className="text-xl font-bold">
                      {category.users.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Avg Quality</p>
                    <p className="text-xl font-bold">
                      {(category.avgQuality * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Events</p>
                    <p className="text-xl font-bold">
                      {category.events.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">User Share</p>
                    <p className="text-xl font-bold text-green-700">
                      {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
                      {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}%
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <Link href="/dashboard/campaigns">
                    <Button variant="outline" className="w-full">
                      Create Campaign for This Data
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Distribution</CardTitle>
          <CardDescription>
            How your campaign budget is distributed (varies by developer)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-green-700">
                {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
                {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}%
              </p>
              <p className="text-sm text-green-600">To Users</p>
              <p className="text-xs text-muted-foreground mt-1">
                Set by developer (default{' '}
                {REVENUE_SHARES.DEFAULT_USER_SHARE_PERCENT}%)
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-3xl font-bold text-blue-700">5-45%</p>
              <p className="text-sm text-blue-600">To Developers</p>
              <p className="text-xs text-muted-foreground mt-1">
                Remainder after platform fee
              </p>
            </div>
            <div className="p-4 bg-gray-100 rounded-lg text-center">
              <p className="text-3xl font-bold text-gray-700">
                {REVENUE_SHARES.PLATFORM_FEE_PERCENT}%
              </p>
              <p className="text-sm text-gray-600">Platform Fee (fixed)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Infrastructure & support
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Look for apps with higher user share percentages to maximize your
            earnings!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
