'use client';

import { useEffect, useState } from 'react';
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
import { getDashboard, getTransactions, type DashboardStats } from '@/lib/api';
import type { Transaction } from '@/lib/types';
import { formatMoney, REVENUE_SHARES } from '@/lib/types';
import {
  Users,
  Code,
  CurrencyDollar,
  Activity,
  TrendUp,
  ChartBar,
  ShoppingCart,
  Eye,
  Database,
  CheckCircle,
  Warning,
  Clock
} from 'phosphor-react';

// Mock data for charts
const eventData = [
  { name: 'Mon', events: 4000, users: 400 },
  { name: 'Tue', events: 3000, users: 350 },
  { name: 'Wed', events: 5000, users: 520 },
  { name: 'Thu', events: 2780, users: 280 },
  { name: 'Fri', events: 4890, users: 490 },
  { name: 'Sat', events: 6390, users: 640 },
  { name: 'Sun', events: 7490, users: 750 },
];

const roleDistribution = [
  { name: 'End Users', value: 1250, color: '#3B82F6' },
  { name: 'Developers', value: 180, color: '#10B981' },
  { name: 'Buyers', value: 45, color: '#8B5CF6' },
];

const mockUsers = [
  { id: '1', name: 'John Developer', email: 'john@dev.io', role: 'developer', status: 'active', apps: 3, revenue: 450.25 },
  { id: '2', name: 'Sarah Buyer', email: 'sarah@corp.com', role: 'buyer', status: 'active', campaigns: 2, spend: 1200 },
  { id: '3', name: 'Mike User', email: 'mike@email.com', role: 'user', status: 'active', earnings: 12.50 },
  { id: '4', name: 'Emma Developer', email: 'emma@startup.io', role: 'developer', status: 'pending', apps: 1, revenue: 0 },
  { id: '5', name: 'Alex Buyer', email: 'alex@bigco.com', role: 'buyer', status: 'active', campaigns: 5, spend: 5400 },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'developer' | 'buyer' | 'user'>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, txData] = await Promise.all([
          getDashboard().catch(() => null),
          getTransactions(10).catch(() => []),
        ]);
        setStats(statsData);
        setTransactions(txData);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredUsers = activeTab === 'all' 
    ? mockUsers 
    : mockUsers.filter(u => u.role === activeTab);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'developer': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Developer</Badge>;
      case 'buyer': return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Buyer</Badge>;
      case 'user': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">End User</Badge>;
      default: return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Console</h1>
          <p className="text-slate-500 mt-1">
            System overview and user management.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
            <Database size={18} className="mr-2" />
            Export Data
          </Button>
          <Button className="bg-primary hover:bg-blue-800 text-white">
            Generate Report
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
                {loading ? '...' : stats?.total_users?.toLocaleString() || '1,475'}
              </div>
              <div className="flex items-center text-xs mt-1 text-emerald-600 font-medium">
                <TrendUp className="mr-1" weight="bold" size={14} />
                +12.3% this month
              </div>
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
                {loading ? '...' : stats?.total_developers?.toLocaleString() || '180'}
              </div>
              <p className="text-xs text-slate-500 mt-1">45 apps published</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Events</CardTitle>
              <Activity size={20} className="text-purple-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? '...' : stats?.total_events?.toLocaleString() || '2.4M'}
              </div>
              <p className="text-xs text-slate-500 mt-1">99.8% quality score</p>
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
                {loading ? '...' : formatMoney(stats?.total_payouts || 48250, 2)}
              </div>
              <p className="text-xs text-slate-500 mt-1">{REVENUE_SHARES.PLATFORM_FEE_PERCENT}% fee collected</p>
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
                <AreaChart data={eventData}>
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
            <CardTitle className="text-lg font-bold text-slate-900">User Distribution</CardTitle>
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
                  <span className="text-xs text-slate-600">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Management */}
      <Card className="glass-panel border-0 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-900">User Management</CardTitle>
          <div className="flex gap-2">
            {(['all', 'developer', 'buyer', 'user'] as const).map((tab) => (
              <Button 
                key={tab}
                variant={activeTab === tab ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? 'bg-primary text-white' : 'text-slate-500'}
              >
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1) + 's'}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-semibold text-slate-500">User</TableHead>
                <TableHead className="font-semibold text-slate-500">Role</TableHead>
                <TableHead className="font-semibold text-slate-500">Status</TableHead>
                <TableHead className="font-semibold text-slate-500">Metrics</TableHead>
                <TableHead className="font-semibold text-slate-500 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-sm">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {user.status === 'active' && <CheckCircle size={12} className="mr-1" weight="fill" />}
                      {user.status === 'pending' && <Clock size={12} className="mr-1" weight="fill" />}
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {user.role === 'developer' && <span className="text-slate-600">{user.apps} apps • ${user.revenue}</span>}
                      {user.role === 'buyer' && <span className="text-slate-600">{user.campaigns} campaigns • ${user.spend}</span>}
                      {user.role === 'user' && <span className="text-slate-600">Earned ${user.earnings}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-primary">
                      <Eye size={16} className="mr-2" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-xs text-slate-500">
                      {tx.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge className={`
                        ${tx.type === 'payout' ? 'bg-emerald-100 text-emerald-700' : ''}
                        ${tx.type === 'fee' ? 'bg-amber-100 text-amber-700' : ''}
                        ${!['payout', 'fee'].includes(tx.type) ? 'bg-slate-100 text-slate-700' : ''}
                      `}>
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatMoney(tx.amount, 6)}</TableCell>
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
