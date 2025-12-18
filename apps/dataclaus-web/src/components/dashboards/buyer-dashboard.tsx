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
import type { AuthUser, Wallet, Campaign } from '@/lib/types';
import { formatMoney } from '@/lib/types';
import { getWalletsByOwner, getCampaignsByBuyer } from '@/lib/api';
import {
  ShoppingBag,
  DollarSign,
  Target,
  TrendingUp,
  Plus,
} from 'lucide-react';
import Link from 'next/link';

interface Props {
  user: AuthUser;
}

export function BuyerDashboard({ user }: Props) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletsData, campaignsData] = await Promise.all([
          getWalletsByOwner(user.id).catch(() => []),
          getCampaignsByBuyer(user.id).catch(() => []),
        ]);
        setWallets(walletsData);
        setCampaigns(campaignsData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalBudget = campaigns.reduce((sum, c) => sum + c.total_budget, 0);
  const totalSpent = campaigns.reduce(
    (sum, c) => sum + (c.total_budget - c.remaining),
    0
  );
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Buyer Dashboard</h1>
          <p className="text-muted-foreground">
            Manage campaigns and fund your account
          </p>
        </div>
        <Link href="/dashboard/campaigns">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Wallet Balance
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatMoney(totalBalance, 2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for campaigns
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Campaigns
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">Running now</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totalBudget, 2)}
            </div>
            <p className="text-xs text-muted-foreground">Allocated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Spent</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(totalSpent, 2)}
            </div>
            <p className="text-xs text-muted-foreground">Total spent</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Campaigns</CardTitle>
          <CardDescription>Recent advertising campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No campaigns yet</p>
              <Link href="/dashboard/campaigns">
                <Button>Create Your First Campaign</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney(campaign.remaining, 2)} remaining of{' '}
                      {formatMoney(campaign.total_budget, 2)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      campaign.status === 'active'
                        ? 'success'
                        : campaign.status === 'paused'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {campaign.status}
                  </Badge>
                </div>
              ))}
              {campaigns.length > 5 && (
                <Link
                  href="/dashboard/campaigns"
                  className="block text-center text-sm text-primary hover:underline"
                >
                  View all {campaigns.length} campaigns
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>Your ad spend distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            When you run a campaign, your budget is distributed to users based
            on their data quality and engagement time. Higher quality data and
            longer engagement means more value for your campaigns.
          </p>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium">Campaign Budget Distribution:</p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• 70% goes to users who provide quality data</li>
              <li>• 20% goes to app developers</li>
              <li>• 10% platform fee</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
