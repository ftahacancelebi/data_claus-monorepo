'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney, REVENUE_SHARES } from '@/lib/types';
import {
  Users,
  Code,
  CurrencyDollar,
  Activity,
  TrendUp,
  ChartBar,
  Database,
  CircleNotch
} from 'phosphor-react';

interface PlatformStats {
  totalUsers: number;
  totalDevelopers: number;
  totalApplications: number;
  totalImpressions: number;
  totalRevenue: number;
  platformFees: number;
  totalTransactions: number;
}

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  walletId: string | null;
  qualityScore: number;
  totalEarned: number;
  pendingBalance: number;
  createdAt: string;
}

interface LedgerTransaction {
  id: string;
  source_wallet_id: string;
  dest_wallet_id: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  created_at: string;
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('dataclaus_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      try {
        const [statsRes, usersRes, txRes] = await Promise.all([
          fetch('/api/admin/stats', { headers }).then(r => r.ok ? r.json() : null),
          fetch('/api/admin/users', { headers }).then(r => r.ok ? r.json() : null),
          fetch('/api/ledger', { headers }).then(r => r.ok ? r.json() : null),
        ]);
        
        setStats(statsRes?.data || statsRes || {
          totalUsers: 0,
          totalDevelopers: 0,
          totalApplications: 0,
          totalImpressions: 0,
          totalRevenue: 0,
          platformFees: 0,
          totalTransactions: 0,
        });
        setUsers(usersRes?.data || usersRes || []);
        setTransactions(txRes?.data || txRes || []);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Build role distribution from real data
  const roleDistribution = [
    { name: 'End Users', value: stats?.totalUsers || 0, color: '#3B82F6' },
    { name: 'Developers', value: stats?.totalDevelopers || 0, color: '#10B981' },
    { name: 'Applications', value: stats?.totalApplications || 0, color: '#8B5CF6' },
  ];

  // Empty chart data
  const chartData = [
    { name: 'Mon', events: 0 },
    { name: 'Tue', events: 0 },
    { name: 'Wed', events: 0 },
    { name: 'Thu', events: 0 },
    { name: 'Fri', events: 0 },
    { name: 'Sat', events: 0 },
    { name: 'Sun', events: stats?.totalImpressions || 0 },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Console</h1>
          <p className="text-slate-500 mt-1">
            System overview and user management - Real data from API
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
            <Database size={18} className="mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Users</CardTitle>
              <Users size={20} className="text-blue-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? <CircleNotch size={24} className="animate-spin text-slate-400" /> : stats?.totalUsers || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">End-users registered</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Developers</CardTitle>
              <Code size={20} className="text-emerald-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? <CircleNotch size={24} className="animate-spin text-slate-400" /> : stats?.totalDevelopers || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">{stats?.totalApplications || 0} apps published</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Impressions</CardTitle>
              <Activity size={20} className="text-purple-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? <CircleNotch size={24} className="animate-spin text-slate-400" /> : stats?.totalImpressions || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">Ad impressions recorded</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Platform Revenue</CardTitle>
              <CurrencyDollar size={20} className="text-amber-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? <CircleNotch size={24} className="animate-spin text-slate-400" /> : `$${(stats?.totalRevenue || 0).toFixed(4)}`}
              </div>
              <p className="text-xs text-slate-500 mt-1">Platform fees: ${(stats?.platformFees || 0).toFixed(4)}</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ChartBar size={20} className="text-primary" />
              Platform Activity (7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="adminEventGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
                    }}
                  />
                  <Area type="monotone" dataKey="events" stroke="#1E3A8A" strokeWidth={2} fill="url(#adminEventGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {roleDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {roleDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs text-slate-600">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card className="glass-panel border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900">End Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-semibold text-slate-500">User</TableHead>
                <TableHead className="font-semibold text-slate-500">Email</TableHead>
                <TableHead className="font-semibold text-slate-500">Total Earned</TableHead>
                <TableHead className="font-semibold text-slate-500">Pending</TableHead>
                <TableHead className="font-semibold text-slate-500">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                    No users registered yet
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-semibold text-sm">
                          {(user.displayName || user.email)?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="font-medium text-slate-900">{user.displayName || 'Unnamed'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{user.email}</TableCell>
                    <TableCell className="font-medium text-emerald-600">${user.totalEarned.toFixed(4)}</TableCell>
                    <TableCell className="font-medium text-amber-600">${user.pendingBalance.toFixed(4)}</TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="glass-panel border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-semibold text-slate-500">ID</TableHead>
                <TableHead className="font-semibold text-slate-500">Type</TableHead>
                <TableHead className="font-semibold text-slate-500">Amount</TableHead>
                <TableHead className="font-semibold text-slate-500">Status</TableHead>
                <TableHead className="font-semibold text-slate-500">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                transactions.slice(0, 10).map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-xs text-slate-500">
                      {tx.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge className={`
                        ${tx.type === 'ad_revenue' ? 'bg-emerald-100 text-emerald-700' : ''}
                        ${tx.type === 'payout' ? 'bg-blue-100 text-blue-700' : ''}
                        ${tx.type === 'fee' ? 'bg-amber-100 text-amber-700' : ''}
                        ${!['ad_revenue', 'payout', 'fee'].includes(tx.type) ? 'bg-slate-100 text-slate-700' : ''}
                      `}>
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">${tx.amount.toFixed(6)}</TableCell>
                    <TableCell>
                      <Badge className={tx.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(tx.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
