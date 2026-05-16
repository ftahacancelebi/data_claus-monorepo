'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import {
  Wallet as WalletIcon,
  ArrowUp,
  ArrowDown,
  Clock,
  CircleNotch,
  Warning,
  CurrencyDollar,
  CaretRight,
  Receipt,
  Plus,
  ArrowsLeftRight,
  Sparkle,
} from 'phosphor-react';
import {
  useWalletsByOwner,
  useWalletTransactions,
  useRevenueShares,
  useMyPayouts,
  useReleasePendingBalance,
} from '@/lib/api-hooks';
import { queryKeys } from '@/lib/query-keys';
import { Wallet, Transaction, formatMoney } from '@/lib/types';
import { WithdrawModal } from '@/components/wallet/withdraw-modal';
import { useRealtime, type WalletCreditedEvent } from '@/lib/realtime';
import { RealtimeStatusBadge } from '@/components/realtime/realtime-status-badge';
import { toast } from '@/components/ui/use-toast';

// Animation: staggered reveal of bento tiles.
const tile = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

// Group transactions into the last 7 calendar days for the spending histogram.
function weeklySpendData(transactions: Transaction[]) {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const totals = new Array<number>(7).fill(0);
  transactions.forEach((tx) => {
    const d = new Date(tx.created_at);
    const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    totals[idx] += Math.max(0, tx.amount);
  });
  const peak = Math.max(...totals);
  return labels.map((name, i) => ({ name, amount: totals[i], peak: peak > 0 && totals[i] === peak }));
}

// Smooth area-chart series for the wide earnings tile. Falls back to a synthetic
// trend so the chart never renders flat-zero on a fresh account.
function earningsAreaData(transactions: Transaction[], balance: number) {
  const labels = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  if (transactions.length > 0) {
    const sorted = [...transactions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const step = Math.max(1, Math.floor(sorted.length / labels.length));
    return labels.map((label, i) => {
      const slice = sorted.slice(i * step, (i + 1) * step);
      const sum = slice.reduce((s, t) => s + Math.max(0, t.amount), 0);
      return { label, amount: Number(sum.toFixed(2)) };
    });
  }
  return labels.map((label, i) => ({
    label,
    amount: balance > 0 ? Number(((balance / 10) * (i + 1) * (0.6 + Math.sin(i / 2) * 0.2)).toFixed(2)) : 0,
  }));
}

const SpendingTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl bg-slate-900 px-3 py-2 text-white shadow-lg">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-sm font-semibold">{formatMoney(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

const AreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl bg-slate-900 px-3 py-2 text-white shadow-lg">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Day {label}</p>
        <p className="text-sm font-semibold">{formatMoney(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

// Small "bank card" chip used inside the hero. Mirrors the reference's
// "My cards" row but represents DataClaus wallets instead.
function WalletChip({
  label,
  type,
  balance,
  variant,
}: {
  label: string;
  type: string;
  balance: number;
  variant: 'mint' | 'sky';
}) {
  const bg = variant === 'mint' ? 'bg-emerald-100' : 'bg-sky-100';
  const accent = variant === 'mint' ? 'text-emerald-700' : 'text-sky-700';
  return (
    <div className={`relative rounded-2xl ${bg} p-3 overflow-hidden`}>
      {/* swooping decorative line, mimics card foil */}
      <svg
        className="absolute -right-4 -top-4 opacity-30"
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
      >
        <path
          d="M 0 60 Q 40 0, 80 40"
          stroke="currentColor"
          strokeWidth="1.5"
          className={accent}
          fill="none"
        />
        <path
          d="M 0 70 Q 40 20, 80 50"
          stroke="currentColor"
          strokeWidth="1"
          className={accent}
          fill="none"
        />
      </svg>
      <div className="relative">
        <div className="h-6 w-8 rounded-md bg-white/70 mb-2" />
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{type}</p>
        <p className="text-sm font-semibold text-slate-900 mt-1 truncate">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{formatMoney(balance)}</p>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Server state — all reads through React Query.
  const walletsQuery = useWalletsByOwner(user?.id);
  const wallets = walletsQuery.data ?? [];
  const primaryWallet = wallets.find((w) => w.type === 'developer') || wallets[0];

  const transactionsQuery = useWalletTransactions(primaryWallet?.id, {
    limit: 10,
    offset: 0,
  });
  const transactions = transactionsQuery.data ?? [];

  const revenueQuery = useRevenueShares();
  const revenueConfig = revenueQuery.data ?? null;

  const payoutsQuery = useMyPayouts();
  const payouts = payoutsQuery.data ?? [];

  const releaseMutation = useReleasePendingBalance();
  const releasing = releaseMutation.isPending;

  const loading =
    walletsQuery.isLoading ||
    revenueQuery.isLoading ||
    payoutsQuery.isLoading;
  const queryError =
    walletsQuery.error || transactionsQuery.error || payoutsQuery.error;
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Could not load your wallet. The API may be unreachable.'
    : null;

  // Realtime: socket event → patch wallets cache. Other panels reading the
  // same wallets key (and the developer dashboard summary) update for free.
  const { on, status } = useRealtime();
  useEffect(() => {
    if (!user?.id) return;
    const off = on<WalletCreditedEvent>('wallet:credited', (event) => {
      const credit = event.userShare ?? event.devShare ?? event.grossRevenue;
      if (typeof credit !== 'number' || credit <= 0) return;

      qc.setQueryData<Wallet[] | undefined>(
        queryKeys.wallets.byOwner(user.id),
        (prev) => {
          if (!prev?.length) return prev;
          const next = [...prev];
          next[0] = { ...next[0], balance: next[0].balance + credit };
          return next;
        },
      );
      qc.invalidateQueries({
        queryKey: [...queryKeys.wallets.byOwner(user.id), 'transactions'],
      });

      toast({
        title: 'Earnings credited',
        description: `+${formatMoney(credit)} from ${event.adType ?? 'ingest event'}`,
      });
    });
    return () => {
      off();
    };
  }, [on, qc, user?.id]);

  // Reconnect safety-net: a dropped socket may have missed a credit event,
  // so on reconnect refetch the visible money surfaces (senior-frontend-flow
  // "reconnect = invalidate"). Skips the first connect (nothing missed yet).
  const socketWasDown = useRef(false);
  useEffect(() => {
    if (status === 'disconnected') socketWasDown.current = true;
    if (status === 'connected' && socketWasDown.current) {
      socketWasDown.current = false;
      qc.invalidateQueries({ queryKey: queryKeys.wallets.all });
      qc.invalidateQueries({ queryKey: queryKeys.earnings.all });
      qc.invalidateQueries({ queryKey: queryKeys.payouts.all });
    }
  }, [status, qc]);

  // Derived values
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalPending = wallets.reduce((sum, w) => sum + w.pending_balance, 0);

  const spendData = useMemo(() => weeklySpendData(transactions), [transactions]);
  const areaData = useMemo(
    () => earningsAreaData(transactions, totalBalance),
    [transactions, totalBalance],
  );

  if (!user) return null;

  const handleReleasePending = async () => {
    if (!primaryWallet) return;
    try {
      await releaseMutation.mutateAsync(primaryWallet.id);
    } catch (err) {
      toast({
        title: 'Couldn’t release pending balance',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      });
    }
  };

  const userPct = revenueConfig?.user_share_percent ?? 70;
  const devPct = revenueConfig?.developer_share_percent ?? 25;
  const platformPct = revenueConfig?.platform_fee_percent ?? 5;

  return (
    <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Finances</h1>
            <p className="text-slate-500 text-sm mt-1">
              Track your earnings, payouts, and revenue share — all in one place.
            </p>
          </div>
          <RealtimeStatusBadge />
        </div>

        {/* Error banner — honest + retryable (no stale Go-API copy) */}
        {error && (
          <div className="mb-4 rounded-3xl bg-red-50 border border-red-200 px-5 py-4 flex items-start gap-3">
            <Warning size={20} className="text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800">
                Couldn&apos;t load your wallet
              </p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void walletsQuery.refetch();
                void transactionsQuery.refetch();
                void payoutsQuery.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {/* ─── TOP BENTO ───
            12-column asymmetric grid:
              Hero balance (5 cols × 2 rows)  |  Spending bars (4 cols × 1)  |  Transactions (3 cols × 2)
                                              |  Revenue split accent (4 × 1)  |
        */}
        <div className="grid grid-cols-12 gap-4 md:auto-rows-[minmax(0,1fr)]">
          {/* HERO: Total balance + wallet chips */}
          <motion.div
            custom={0}
            variants={tile}
            initial="hidden"
            animate="show"
            className="col-span-12 md:col-span-5 md:row-span-2"
          >
            <Card className="h-full rounded-3xl border-0 bg-white shadow-sm">
              <CardContent className="p-6 md:p-7 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">Total balance</p>
                  <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center">
                    <WalletIcon size={18} className="text-slate-600" weight="duotone" />
                  </div>
                </div>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {loading ? '—' : formatMoney(totalBalance).replace(/\.\d+$/, '')}
                  </span>
                  <span className="text-2xl font-semibold text-slate-300 tabular-nums">
                    {loading ? '' : (formatMoney(totalBalance).match(/\.\d+$/)?.[0] ?? '.00')}
                  </span>
                </div>

                {/* Send / Receive style actions */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 border-0 h-10 px-4 gap-2"
                    disabled={loading || totalBalance < 0.01}
                    onClick={() => setWithdrawOpen(true)}
                  >
                    <ArrowDown size={16} weight="bold" />
                    Withdraw
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 border-0 h-10 px-4 gap-2"
                    disabled={releasing || totalPending < 0.01}
                    onClick={handleReleasePending}
                  >
                    {releasing ? (
                      <CircleNotch size={16} className="animate-spin" />
                    ) : (
                      <ArrowUp size={16} weight="bold" />
                    )}
                    Release pending
                  </Button>
                </div>

                {/* Pending strip */}
                <div className="mt-4 rounded-2xl bg-amber-50/70 px-4 py-3 flex items-center gap-3">
                  <Clock size={16} className="text-amber-600" weight="duotone" />
                  <div className="flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-amber-700 font-semibold">
                      Pending
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {loading ? '—' : formatMoney(totalPending)}
                    </p>
                  </div>
                  <p className="text-[11px] text-amber-700/80 max-w-[120px] text-right">
                    Micro-payments held below threshold
                  </p>
                </div>

                {/* My wallets — bank-card chips */}
                <div className="mt-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">My wallets</h3>
                    <span className="text-xs text-slate-400">
                      {wallets.length} active
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 flex-1 min-h-[110px]">
                    {wallets.slice(0, 2).map((w, i) => (
                      <WalletChip
                        key={w.id}
                        label={w.currency || 'USD'}
                        type={w.type}
                        balance={w.balance}
                        variant={i === 0 ? 'sky' : 'mint'}
                      />
                    ))}
                    {/* +Add slot to fill the grid */}
                    <button
                      type="button"
                      className="rounded-2xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors min-h-[110px]"
                      aria-label="Add wallet"
                    >
                      <Plus size={22} weight="bold" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* SPENDING BARS — weekly earnings histogram */}
          <motion.div
            custom={1}
            variants={tile}
            initial="hidden"
            animate="show"
            className="col-span-12 md:col-span-4"
          >
            <Card className="h-full rounded-3xl border-0 bg-white shadow-sm">
              <CardContent className="p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-slate-900">Spending</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                    Week
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Peak day{' '}
                  <span className="font-semibold text-slate-700">
                    {formatMoney(Math.max(...spendData.map((d) => d.amount), 0))}
                  </span>
                </p>
                <div className="flex-1 mt-3 min-h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spendData} barCategoryGap={6}>
                      <Tooltip content={<SpendingTooltip />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                      <XAxis
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Bar dataKey="amount" radius={[8, 8, 8, 8]}>
                        {spendData.map((d, i) => (
                          <Cell key={i} fill={d.peak ? '#0f172a' : '#cbd5e1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* TRANSACTIONS — tall list spanning 2 rows */}
          <motion.div
            custom={2}
            variants={tile}
            initial="hidden"
            animate="show"
            className="col-span-12 md:col-span-3 md:row-span-2"
          >
            <Card className="h-full rounded-3xl border-0 bg-white shadow-sm">
              <CardContent className="p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Transactions</h3>
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5"
                  >
                    See all <CaretRight size={12} weight="bold" />
                  </button>
                </div>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <CircleNotch size={24} className="animate-spin text-slate-300" />
                  </div>
                ) : transactions.length > 0 ? (
                  <ul className="flex-1 overflow-y-auto -mx-2 divide-y divide-slate-50">
                    {transactions.slice(0, 6).map((tx) => (
                      <li
                        key={tx.id}
                        className="px-2 py-2.5 flex items-center gap-2.5 hover:bg-slate-50/70 rounded-xl transition-colors"
                      >
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                            tx.type === 'payout'
                              ? 'bg-emerald-100 text-emerald-700'
                              : tx.type === 'fee'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          {tx.type === 'payout' ? (
                            <ArrowDown size={14} weight="bold" />
                          ) : tx.type === 'fee' ? (
                            <ArrowUp size={14} weight="bold" />
                          ) : (
                            <Receipt size={14} weight="bold" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 capitalize truncate">
                            {tx.type}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(tx.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <p
                          className={`text-sm font-semibold tabular-nums ${
                            tx.type === 'fee' ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {tx.type === 'fee' ? '-' : '+'}
                          {formatMoney(tx.amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <CurrencyDollar size={22} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">No activity yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Earnings will appear as events process.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* REVENUE SPLIT — mint accent card (replaces reference "How to manage money") */}
          <motion.div
            custom={3}
            variants={tile}
            initial="hidden"
            animate="show"
            className="col-span-12 md:col-span-4"
          >
            <Card className="h-full rounded-3xl border-0 bg-emerald-50 shadow-sm overflow-hidden relative">
              <svg
                className="absolute -right-6 -top-6 opacity-40"
                width="160"
                height="160"
                viewBox="0 0 160 160"
                fill="none"
              >
                <circle cx="80" cy="80" r="60" stroke="#a7f3d0" strokeWidth="1.5" />
                <circle cx="80" cy="80" r="40" stroke="#a7f3d0" strokeWidth="1.5" />
                <circle cx="80" cy="80" r="20" stroke="#a7f3d0" strokeWidth="1.5" />
              </svg>
              <CardContent className="p-5 h-full flex flex-col relative">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkle size={18} className="text-emerald-700" weight="fill" />
                  <h3 className="text-sm font-semibold text-emerald-900">Revenue split</h3>
                </div>
                <p className="text-lg font-bold text-emerald-950 leading-snug max-w-[14ch]">
                  How your earnings flow.
                </p>

                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-emerald-800/80">Users</dt>
                    <dd className="font-semibold text-emerald-950 tabular-nums">{userPct}%</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-emerald-800/80">Developer</dt>
                    <dd className="font-semibold text-emerald-950 tabular-nums">{devPct}%</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-emerald-800/80">Platform fee</dt>
                    <dd className="font-semibold text-emerald-950 tabular-nums">{platformPct}%</dd>
                  </div>
                </dl>

                <div className="mt-auto pt-3">
                  <Button
                    size="sm"
                    className="rounded-full bg-emerald-900 hover:bg-emerald-950 text-white border-0 h-9 px-4"
                  >
                    Learn more
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ─── BOTTOM BENTO ───
            Earnings area chart (8 cols)  |  Share score gauge (4 cols)
        */}
        <div className="mt-4 grid grid-cols-12 gap-4">
          <motion.div
            custom={4}
            variants={tile}
            initial="hidden"
            animate="show"
            className="col-span-12 md:col-span-8"
          >
            <Card className="h-full rounded-3xl border-0 bg-white shadow-sm">
              <CardContent className="p-5 md:p-6 h-full">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Earnings</h3>
                    <p className="text-xs text-slate-500">Last 10 sessions</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600 inline-flex items-center gap-1">
                    <ArrowsLeftRight size={12} /> 10d
                  </span>
                </div>
                <div className="h-[230px] md:h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={areaData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="walletAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="label"
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip content={<AreaTooltip />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        stroke="#0f172a"
                        strokeWidth={2}
                        fill="url(#walletAreaFill)"
                        dot={{ r: 0 }}
                        activeDot={{ r: 5, fill: '#0f172a', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* PAYOUT REQUESTS — moved into the share-score slot */}
          <motion.div
            custom={5}
            variants={tile}
            initial="hidden"
            animate="show"
            className="col-span-12 md:col-span-4"
          >
            <Card className="h-full rounded-3xl border-0 bg-white shadow-sm">
              <CardContent className="p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Payout requests</h3>
                    <p className="text-[11px] text-slate-500">From this wallet</p>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full h-9 px-3.5 text-xs"
                    onClick={() => setWithdrawOpen(true)}
                    disabled={totalBalance < 0.01}
                  >
                    New withdrawal
                  </Button>
                </div>

                {payouts.length > 0 ? (
                  <ul className="mt-3 flex-1 overflow-y-auto -mx-1 space-y-1.5 pr-1">
                    {payouts.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/70 transition-colors px-3 py-2.5"
                      >
                        <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <ArrowDown size={14} weight="bold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {p.method === 'bank_simulation' ? 'Bank' : 'Crypto'} payout
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(p.requested_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          {p.rejection_reason && (
                            <p className="text-[11px] text-rose-500 mt-0.5 truncate">
                              {p.rejection_reason}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-900 tabular-nums">
                            {formatMoney(Number(p.amount))}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] mt-0.5 ${
                              p.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : p.status === 'rejected' || p.status === 'failed'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {p.status}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-2 mt-3">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                      <ArrowDown size={20} className="text-slate-400" weight="bold" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">No payout requests yet</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-[28ch]">
                      Click &ldquo;New withdrawal&rdquo; to move funds out of the platform.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        availableBalance={totalBalance}
        currency={primaryWallet?.currency || 'USD'}
      />
    </div>
  );
}
