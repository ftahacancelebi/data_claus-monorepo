'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataclausScoreGauge } from '@/components/packages/score-gauge';
import { useMyPurchases, useWalletsByOwner } from '@/lib/api-hooks';
import { formatMoney } from '@/lib/types';
import type { AuthUser } from '@/lib/types';
import {
  ShoppingCart,
  Database,
  Wallet as WalletIcon,
  Lightning,
  Warning,
  ArrowRight,
} from 'phosphor-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

interface DashboardProps {
  user: AuthUser;
}

function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.div variants={item}>
      <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-slate-900">{value}</div>
          <p className="text-xs text-slate-500 mt-1">{hint}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function BuyerDashboard({ user }: DashboardProps) {
  // Server state — single React Query cache layer. Read-only landing; the
  // purchases cache is invalidated by usePurchasePackage elsewhere, so this
  // screen reflects new purchases without its own mutation/invalidation.
  const purchasesQuery = useMyPurchases();
  const walletsQuery = useWalletsByOwner(user?.id);

  const purchases = purchasesQuery.data ?? [];
  const wallet =
    walletsQuery.data?.find((w) => w.type === 'buyer') ??
    walletsQuery.data?.[0] ??
    null;

  const loading = purchasesQuery.isLoading || walletsQuery.isLoading;
  const isError = purchasesQuery.isError || walletsQuery.isError;

  const totalSpent = purchases.reduce((sum, p) => sum + Number(p.amount), 0);
  const scored = purchases
    .map((p) => p.package?.dataclausScore)
    .filter((s): s is number => typeof s === 'number');
  const avgScore =
    scored.length > 0
      ? scored.reduce((a, b) => a + b, 0) / scored.length
      : null;

  const header = (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Data Acquisition Hub
        </h2>
        <p className="text-slate-500 mt-1">
          Acquire AI-certified, high-quality datasets at scale.
        </p>
      </div>
      <Link href="/dashboard/marketplace">
        <Button className="bg-primary hover:bg-blue-800 text-white shadow-md">
          <Database size={18} className="mr-2" />
          Browse Marketplace
        </Button>
      </Link>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-8">
        {header}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-slate-100 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-8">
        {header}
        <Card className="glass-panel border border-red-200 shadow-lg">
          <CardContent className="py-10 flex items-start gap-3">
            <Warning size={22} className="text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800">
                Couldn&apos;t load your acquisition data
              </p>
              <p className="text-sm text-red-600 mt-1">
                {purchasesQuery.error instanceof Error
                  ? purchasesQuery.error.message
                  : 'The API is unreachable. Please retry.'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void purchasesQuery.refetch();
                void walletsQuery.refetch();
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {header}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          title="Wallet Balance"
          value={wallet ? formatMoney(wallet.balance, 2) : '$0.00'}
          hint="Available to acquire datasets"
          icon={
            <WalletIcon size={20} className="text-emerald-500" weight="duotone" />
          }
        />
        <StatCard
          title="Total Spent"
          value={formatMoney(totalSpent, 2)}
          hint={`${purchases.length} purchase${purchases.length !== 1 ? 's' : ''}`}
          icon={
            <ShoppingCart size={20} className="text-purple-500" weight="duotone" />
          }
        />
        <StatCard
          title="Packages Owned"
          value={purchases.length}
          hint="Datasets you can download"
          icon={<Database size={20} className="text-blue-500" weight="duotone" />}
        />
        <StatCard
          title="Avg. Trust Score"
          value={avgScore !== null ? avgScore.toFixed(2) : '—'}
          hint={
            avgScore !== null
              ? 'DataClaus-certified quality'
              : 'No purchases yet'
          }
          icon={
            <Lightning size={20} className="text-amber-500" weight="duotone" />
          }
        />
      </motion.div>

      {purchases.length === 0 ? (
        <Card className="glass-panel border-0 shadow-xl">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Database size={32} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                No datasets acquired yet
              </h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                Browse the marketplace to find AI-certified, high-quality
                datasets verified by the DataClaus auditor.
              </p>
              <Link href="/dashboard/marketplace">
                <Button className="bg-primary hover:bg-blue-800 text-white shadow-md">
                  <Database size={18} className="mr-2" />
                  Browse Marketplace
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-800">
              Recent Acquisitions
            </CardTitle>
            <Link
              href="/dashboard/purchases"
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {purchases.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/marketplace/${p.packageId}`}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group"
                >
                  <div className="shrink-0">
                    <DataclausScoreGauge
                      value={p.package?.dataclausScore ?? null}
                      size="sm"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">
                      {p.package?.title ?? 'Dataset package'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {p.package?.category && (
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                        >
                          {p.package.category}
                        </Badge>
                      )}
                      <span className="text-xs text-slate-400">
                        {new Date(p.purchasedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900">
                      {formatMoney(Number(p.amount), 2)}
                    </p>
                    <p className="text-[11px] text-slate-400">paid</p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-slate-300 group-hover:text-primary transition-colors shrink-0"
                  />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
