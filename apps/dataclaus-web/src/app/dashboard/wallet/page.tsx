'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/lib/auth-context';
import { 
  Wallet as WalletIcon, 
  ArrowUp, 
  ArrowDown, 
  Clock, 
  TrendUp,
  CircleNotch,
  Warning,
  CurrencyDollar,
  CaretRight,
  Receipt
} from 'phosphor-react';
import {
  getWalletsByOwner,
  getWalletTransactions,
  releasePendingBalance,
  getRevenueShares,
  listMyPayouts,
  RevenueShareConfig,
  PayoutRecord
} from '@/lib/api';
import { Wallet, Transaction, formatMoney } from '@/lib/types';
import { WithdrawModal } from '@/components/wallet/withdraw-modal';
import { useRealtime, type WalletCreditedEvent } from '@/lib/realtime';
import { RealtimeStatusBadge } from '@/components/realtime/realtime-status-badge';
import { toast } from '@/components/ui/use-toast';

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

// Generate earnings chart data from transactions or balance
const generateEarningsData = (transactions: Transaction[], totalBalance: number = 0) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // If we have transactions, group them by day of week
  if (transactions.length > 0) {
    const dayTotals = new Map<string, number>();
    days.forEach(d => dayTotals.set(d, 0));
    
    transactions.forEach(tx => {
      const date = new Date(tx.created_at);
      const dayName = days[date.getDay() === 0 ? 6 : date.getDay() - 1]; // Adjust for Mon-Sun
      dayTotals.set(dayName, (dayTotals.get(dayName) || 0) + tx.amount);
    });
    
    return days.map(day => ({ name: day, amount: dayTotals.get(day) || 0 }));
  }
  
  // Fallback: generate trend data leading to totalBalance
  return days.map((day, i) => ({
    name: day,
    amount: totalBalance > 0 ? (totalBalance / 7) * (i + 1) * (0.5 + Math.random() * 0.5) : 0
  }));
};

// Custom tooltip for chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-lg font-bold">${payload[0].value.toFixed(2)}</p>
      </div>
    );
  }
  return null;
};

export default function WalletPage() {
  const { user } = useAuth();
  
  // Real API state
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [revenueConfig, setRevenueConfig] = useState<RevenueShareConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const refreshWallets = async (userId: string) => {
    const userWallets = await getWalletsByOwner(userId);
    setWallets(userWallets || []);
    return userWallets;
  };

  const refreshPayouts = async () => {
    try {
      const list = await listMyPayouts();
      setPayouts(list || []);
    } catch (err) {
      console.warn('Failed to fetch payouts:', err);
    }
  };

  // Fetch wallet data from backend
  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;

      setLoading(true);
      setError(null);

      try {
        const userWallets = await refreshWallets(user.id);

        if (userWallets && userWallets.length > 0) {
          const txns = await getWalletTransactions(userWallets[0].id, 10, 0);
          setTransactions(txns || []);
        }

        const config = await getRevenueShares();
        setRevenueConfig(config);

        await refreshPayouts();
      } catch (err) {
        console.error('Failed to fetch wallet data:', err);
        setError('Backend not connected. Start the Go API to see real data.');
        setWallets([]);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user?.id]);

  // Phase 4 — Realtime: live wallet credit updates.
  const { on } = useRealtime();
  useEffect(() => {
    const off = on<WalletCreditedEvent>('wallet:credited', (event) => {
      const credit = event.userShare ?? event.devShare ?? event.grossRevenue;
      if (typeof credit !== 'number' || credit <= 0) return;

      setWallets((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        next[0] = { ...next[0], balance: next[0].balance + credit };
        return next;
      });

      toast({
        title: 'Earnings credited',
        description: `+${formatMoney(credit)} from ${event.adType ?? 'ingest event'}`,
      });
    });
    return () => {
      off();
    };
  }, [on]);

  if (!user) return null;

  // Calculate totals from wallets
  const primaryWallet = wallets.find(w => w.type === 'developer') || wallets[0];
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const totalPending = wallets.reduce((sum, w) => sum + w.pending_balance, 0);

  const handleReleasePending = async () => {
    if (!primaryWallet) return;
    
    setReleasing(true);
    try {
      await releasePendingBalance(primaryWallet.id);
      // Refresh wallet data
      const userWallets = await getWalletsByOwner(user.id);
      setWallets(userWallets || []);
    } catch (err) {
      console.error('Failed to release pending balance:', err);
    } finally {
      setReleasing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Finances</h1>
          <p className="text-slate-500 mt-1">
            Track your earnings and manage your wallet.
          </p>
        </div>
        <RealtimeStatusBadge />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Warning size={20} className="text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">{error}</p>
            <p className="text-sm text-amber-600 mt-1">
              Run the backend to see your real wallet balance and transactions.
            </p>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {/* Available Balance - Primary Card */}
        <motion.div variants={item} className="lg:col-span-2">
          <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-0 shadow-2xl shadow-slate-900/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
            <CardContent className="p-6 relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <WalletIcon size={24} className="text-white" weight="duotone" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm font-medium">Available Balance</p>
                  <p className="text-3xl font-bold text-white">
                    {loading ? '-' : formatMoney(totalBalance)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-slate-500 text-xs">Currency</p>
                  <p className="text-white font-semibold">{primaryWallet?.currency || 'USD'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Wallet Type</p>
                  <p className="text-white font-semibold capitalize">{primaryWallet?.type || 'Developer'}</p>
                </div>
                <div className="ml-auto">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/10 text-white hover:bg-white/20 border-0"
                    disabled={loading || totalBalance < 0.01}
                    onClick={() => setWithdrawOpen(true)}
                  >
                    Withdraw
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Balance */}
        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock size={20} className="text-amber-600" weight="duotone" />
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Pending</p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '-' : formatMoney(totalPending)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Micro-payments below $0.01
              </p>
              {totalPending >= 0.01 && (
                <Button 
                  size="sm" 
                  className="mt-3 w-full"
                  onClick={handleReleasePending}
                  disabled={releasing}
                >
                  {releasing ? (
                    <CircleNotch size={14} className="animate-spin mr-2" />
                  ) : null}
                  Release to Balance
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Revenue Share Info */}
        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg h-full">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <TrendUp size={20} className="text-blue-600" weight="duotone" />
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Your Share</p>
              <p className="text-2xl font-bold text-slate-900">
                {revenueConfig ? `${revenueConfig.developer_share_percent}%` : '-'}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Platform fee: {revenueConfig?.platform_fee_percent ?? 5}%
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Charts and Transactions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Earnings Chart */}
        <Card className="lg:col-span-2 glass-panel border-0 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-800">Earnings Overview</CardTitle>
            <p className="text-sm text-slate-500">Your earnings trend over time</p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={generateEarningsData(transactions, totalBalance)}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    fill="url(#colorAmount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400 text-center mt-4">
              Real earnings data will appear after processing events
            </p>
          </CardContent>
        </Card>
        
        {/* Revenue Split Info */}
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-slate-800">Revenue Split</CardTitle>
            <p className="text-sm text-slate-500">How earnings are distributed</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Users</span>
                <span className="text-sm font-bold text-slate-900">{revenueConfig?.user_share_percent ?? 70}%</span>
              </div>
              <Progress value={revenueConfig?.user_share_percent ?? 70} className="h-2" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Developer (You)</span>
                <span className="text-sm font-bold text-slate-900">{revenueConfig?.developer_share_percent ?? 25}%</span>
              </div>
              <Progress value={revenueConfig?.developer_share_percent ?? 25} className="h-2 [&>div]:bg-blue-500" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Platform Fee</span>
                <span className="text-sm font-bold text-slate-900">{revenueConfig?.platform_fee_percent ?? 5}%</span>
              </div>
              <Progress value={revenueConfig?.platform_fee_percent ?? 5} className="h-2 [&>div]:bg-slate-400" />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                <strong>Min Payout:</strong> ${revenueConfig?.min_payout_threshold ?? 0.01}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Earnings below this threshold are held in pending balance.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="glass-panel border-0 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-800">Recent Transactions</CardTitle>
            <p className="text-sm text-slate-500">Your latest financial activity</p>
          </div>
          <Button variant="ghost" size="sm" className="text-primary">
            View All <CaretRight size={14} className="ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <CircleNotch size={32} className="animate-spin text-slate-400" />
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx, i) => (
                <motion.div 
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    tx.type === 'payout' ? 'bg-emerald-50 text-emerald-600' : 
                    tx.type === 'fee' ? 'bg-red-50 text-red-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {tx.type === 'payout' ? <ArrowDown size={18} /> : 
                     tx.type === 'fee' ? <ArrowUp size={18} /> : 
                     <Receipt size={18} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 capitalize">{tx.type}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      tx.type === 'payout' ? 'text-emerald-600' : 'text-slate-900'
                    }`}>
                      {tx.type === 'payout' ? '+' : ''}{formatMoney(tx.amount)}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {tx.status}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <CurrencyDollar size={28} className="text-slate-400" />
              </div>
              <p className="font-medium text-slate-600">No transactions yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Transactions will appear here when data flows through the system.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card className="glass-panel border-0 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-800">Payout Requests</CardTitle>
            <p className="text-sm text-slate-500">Withdrawals submitted from this wallet</p>
          </div>
          <Button
            size="sm"
            onClick={() => setWithdrawOpen(true)}
            disabled={totalBalance < 0.01}
          >
            New Withdrawal
          </Button>
        </CardHeader>
        <CardContent>
          {payouts.length > 0 ? (
            <div className="space-y-3">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ArrowDown size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">
                      {p.method === 'bank_simulation' ? 'Bank' : 'Crypto'} payout
                    </p>
                    <p className="text-xs text-slate-500">
                      Requested {new Date(p.requested_at).toLocaleString()}
                    </p>
                    {p.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1">
                        {p.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">
                      {formatMoney(Number(p.amount))}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        p.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : p.status === 'rejected' || p.status === 'failed'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {p.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="font-medium text-slate-600">No payout requests yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Click &quot;New Withdrawal&quot; to move funds out of the platform.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        availableBalance={totalBalance}
        currency={primaryWallet?.currency || 'USD'}
        onSuccess={async () => {
          if (user?.id) {
            await refreshWallets(user.id);
          }
          await refreshPayouts();
        }}
      />
    </div>
  );
}
