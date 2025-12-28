'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { 
    ChartBar,
    TrendUp,
    Users,
    Activity,
    CurrencyDollar,
    Database,
    Calendar,
    ArrowUp,
    ArrowDown
} from 'phosphor-react';

// Mock Data
const revenueData = [
  { month: 'Jan', revenue: 12400, users: 420 },
  { month: 'Feb', revenue: 15800, users: 580 },
  { month: 'Mar', revenue: 18200, users: 720 },
  { month: 'Apr', revenue: 22400, users: 890 },
  { month: 'May', revenue: 28600, users: 1100 },
  { month: 'Jun', revenue: 32100, users: 1280 },
  { month: 'Jul', revenue: 38500, users: 1420 },
  { month: 'Aug', revenue: 42200, users: 1580 },
  { month: 'Sep', revenue: 45800, users: 1720 },
  { month: 'Oct', revenue: 52400, users: 1890 },
  { month: 'Nov', revenue: 58200, users: 2100 },
  { month: 'Dec', revenue: 64800, users: 2350 },
];

const eventsByType = [
  { name: 'INGEST', value: 45000, color: '#3B82F6' },
  { name: 'AUTH', value: 28000, color: '#10B981' },
  { name: 'RISK_CHECK', value: 18000, color: '#8B5CF6' },
  { name: 'PAYOUT', value: 9000, color: '#F59E0B' },
];

const qualityTrend = [
  { day: 'Mon', score: 94.2 },
  { day: 'Tue', score: 95.1 },
  { day: 'Wed', score: 93.8 },
  { day: 'Thu', score: 96.2 },
  { day: 'Fri', score: 95.8 },
  { day: 'Sat', score: 97.1 },
  { day: 'Sun', score: 96.5 },
];

const topDevelopers = [
  { name: 'John Smith', apps: 5, revenue: 12500, users: 3200 },
  { name: 'Emma Davis', apps: 3, revenue: 8900, users: 2100 },
  { name: 'Alex Chen', apps: 4, revenue: 7200, users: 1800 },
  { name: 'Lisa Wang', apps: 2, revenue: 5400, users: 1200 },
  { name: 'David Kim', apps: 3, revenue: 4800, users: 950 },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Analytics</h1>
            <p className="text-slate-500 mt-1">
              Comprehensive metrics and performance insights.
            </p>
         </div>
         <div className="flex gap-2">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <Button 
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className={timeRange === range ? 'bg-primary text-white' : 'bg-white'}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
              </Button>
            ))}
         </div>
      </div>

      {/* Key Metrics */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <CurrencyDollar size={24} className="text-emerald-500" weight="duotone" />
                <span className="flex items-center text-xs font-medium text-emerald-600">
                  <ArrowUp size={12} className="mr-1" />+18.2%
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900">$64,800</p>
              <p className="text-xs text-slate-500 mt-1">Total Revenue (MTD)</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Users size={24} className="text-blue-500" weight="duotone" />
                <span className="flex items-center text-xs font-medium text-emerald-600">
                  <ArrowUp size={12} className="mr-1" />+12.5%
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900">2,350</p>
              <p className="text-xs text-slate-500 mt-1">Active Users</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Activity size={24} className="text-purple-500" weight="duotone" />
                <span className="flex items-center text-xs font-medium text-emerald-600">
                  <ArrowUp size={12} className="mr-1" />+24.8%
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900">100K</p>
              <p className="text-xs text-slate-500 mt-1">Events Processed</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Database size={24} className="text-amber-500" weight="duotone" />
                <span className="flex items-center text-xs font-medium text-red-600">
                  <ArrowDown size={12} className="mr-1" />-2.1%
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900">18ms</p>
              <p className="text-xs text-slate-500 mt-1">Avg Latency</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendUp size={20} className="text-emerald-500" />
              Revenue & User Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fill="url(#revenueGradient)" />
                  <Line yAxisId="right" type="monotone" dataKey="users" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-emerald-500"></div>
                <span className="text-xs text-slate-600">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-blue-500"></div>
                <span className="text-xs text-slate-600">Users</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ChartBar size={20} className="text-primary" />
              Events by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={eventsByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {eventsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {eventsByType.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs font-medium text-slate-700">{item.name}</span>
                  </div>
                  <span className="text-xs text-slate-500">{(item.value/1000).toFixed(0)}k</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Top Developers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topDevelopers.map((dev, index) => (
                <div key={dev.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{dev.name}</p>
                      <p className="text-xs text-slate-500">{dev.apps} apps • {dev.users.toLocaleString()} users</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">${dev.revenue.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">revenue</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Quality Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={qualityTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="day" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} domain={[90, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={3} dot={{ fill: '#10B981', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800">Avg Quality Score</span>
                <span className="text-lg font-bold text-emerald-700">95.5%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
