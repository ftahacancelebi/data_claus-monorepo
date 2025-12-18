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
import type { AuthUser, Wallet, Transaction } from '@/lib/types';
import { formatMoney, REVENUE_SHARES } from '@/lib/types';
import {
  getWalletsByOwner,
  getWalletTransactions,
  getUserQualityScore,
} from '@/lib/api';
import { Wallet as WalletIcon, TrendingUp, Star, Clock } from 'lucide-react';

interface Props {
  user: AuthUser;
}

export function UserDashboard({ user }: Props) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [qualityScore, setQualityScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const walletsData = await getWalletsByOwner(user.id).catch(() => []);
        setWallets(walletsData);

        // Fetch transactions for first wallet
        if (walletsData.length > 0) {
          const txData = await getWalletTransactions(
            walletsData[0].id,
            5
          ).catch(() => []);
          setTransactions(txData);
        }

        // Fetch quality score
        const scoreData = await getUserQualityScore(user.id).catch(() => ({
          quality_score: 0,
        }));
        setQualityScore(scoreData.quality_score);
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

  // Calculate estimated earnings based on quality score
  // Formula: quality_score * active_time_hours * base_rate
  const estimatedHourlyRate = qualityScore * 0.1; // $0.10 per hour at 100% quality

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {user.name}!</h1>
        <p className="text-muted-foreground">Your personal dashboard</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Available Balance
            </CardTitle>
            <WalletIcon className="h-4 w-4 text-muted-foreground" />
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
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `${(qualityScore * 100).toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              Your data quality rating
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Est. Hourly Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatMoney(estimatedHourlyRate, 4)}/hr
            </div>
            <p className="text-xs text-muted-foreground">
              Based on quality score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Your Share</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
              {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}%
            </div>
            <p className="text-xs text-muted-foreground">Varies by app</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How Earnings Work</CardTitle>
          <CardDescription>
            Revenue sharing breakdown (varies by app developer)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span>You (User)</span>
              <Badge variant="default" className="bg-green-600">
                {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
                {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}%
              </Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span>App Developer</span>
              <Badge variant="secondary">5-45%</Badge>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span>Platform Fee (fixed)</span>
              <Badge variant="outline">
                {REVENUE_SHARES.PLATFORM_FEE_PERCENT}%
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Your earnings = Quality Score × Active Usage Time × Ad Revenue ×
              User Share %
              <br />
              <span className="text-xs">
                💡 Choose apps with higher user share to maximize earnings!
                Amounts below ${REVENUE_SHARES.MIN_PAYOUT_THRESHOLD} are held as
                pending.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Earnings</CardTitle>
          <CardDescription>Your latest transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{tx.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      tx.type === 'payout' ? 'text-green-600' : ''
                    }`}
                  >
                    {tx.type === 'payout' ? '+' : ''}
                    {formatMoney(tx.amount, 6)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
