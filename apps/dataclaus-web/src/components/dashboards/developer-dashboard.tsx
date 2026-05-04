'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
import { useAuth } from '@/lib/auth-context';
import type { AuthUser, ApiKey } from '@/lib/types';
import { getDashboard, DashboardStats, listApiKeys } from '@/lib/api';
import { 
    TrendUp, 
    TrendDown, 
    ArrowRight, 
    Users, 
    Database, 
    CurrencyDollar, 
    Activity,
    Plus,
    Book,
    Code,
    CircleNotch,
    Warning,
    Key
} from 'phosphor-react';
import { GettingStarted } from '../dashboard/getting-started';
import { LiveChart } from '@/components/realtime/live-chart';
import { RealtimeStatusBadge } from '@/components/realtime/realtime-status-badge';
import { ShakeFeed } from '@/components/demo/shake-feed';

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

// Generate chart data from stats (simplified - shows trend to current value)
const generateChartData = (totalPayouts: number = 0) => {
  const today = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = today.getMonth();
  
  // Create last 7 months of data leading up to current total
  return Array.from({ length: 7 }, (_, i) => {
    const monthIndex = (currentMonth - 6 + i + 12) % 12;
    const progress = (i + 1) / 7;
    return {
      name: months[monthIndex],
      events: 0,
      earnings: i === 6 ? totalPayouts : totalPayouts * progress * 0.8
    };
  });
};

interface DashboardProps {
  user: AuthUser;
}

export function DeveloperDashboard({ user }: DashboardProps) {
  const [showGettingStarted, setShowGettingStarted] = useState(true);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  
  // Real API state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [apps, setApps] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check completed steps on mount
  useEffect(() => {
    const savedSteps = localStorage.getItem('dataclaus_completed_steps');
    if (savedSteps) {
      setCompletedSteps(JSON.parse(savedSteps));
    }
  }, []);

  // Fetch real data from API
  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch dashboard stats and apps in parallel
        const [dashboardStats, apiKeys] = await Promise.all([
          getDashboard(),
          listApiKeys(user.id)
        ]);
        
        setStats(dashboardStats);
        setApps(apiKeys || []);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Backend not connected. Start the Go API to see real data.');
        // Set default values for demo
        setStats({
          total_events: 0,
          total_users: 0,
          total_developers: 0,
          average_quality: 0,
          total_payouts: 0,
          active_campaigns: 0,
        });
        setApps([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [user?.id]);

  const handleDismissGettingStarted = () => {
    setShowGettingStarted(false);
  };

  // Format numbers nicely
  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
            <RealtimeStatusBadge />
          </div>
          <p className="text-slate-500 mt-1">
             Welcome back, {user.name}. Here's what's happening today.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/docs">
            <Button variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">
               <Book size={18} className="mr-2" />
               View Documentation
            </Button>
          </Link>
          <Link href="/dashboard/my-apps">
            <Button className="bg-primary hover:bg-blue-700 text-white shadow-md shadow-blue-600/20">
               <Plus weight="bold" className="mr-2" /> New App
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Warning size={20} className="text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">{error}</p>
            <p className="text-sm text-amber-600 mt-1">
              Run: <code className="bg-amber-100 px-1 rounded">docker-compose up -d</code> and <code className="bg-amber-100 px-1 rounded">go run apps/dataclaus-api/cmd/api</code>
            </p>
          </div>
        </div>
      )}

      {/* Getting Started (for new users) */}
      {showGettingStarted && (
        <GettingStarted 
          completedSteps={completedSteps} 
          onDismiss={handleDismissGettingStarted}
        />
      )}

      {/* Stats Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={item}>
            <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Payouts</CardTitle>
                <CurrencyDollar size={20} className="text-emerald-500" weight="duotone" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {loading ? (
                    <CircleNotch size={24} className="animate-spin text-slate-400" />
                  ) : (
                    `$${stats?.total_payouts?.toLocaleString() ?? '0'}`
                  )}
                </div>
                <div className="flex items-center text-xs text-slate-500 mt-1 font-medium">
                    Real-time from ledger
                </div>
            </CardContent>
            </Card>
        </motion.div>
        
        <motion.div variants={item}>
            <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Total Users</CardTitle>
                <Users size={20} className="text-blue-500" weight="duotone" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {loading ? (
                    <CircleNotch size={24} className="animate-spin text-slate-400" />
                  ) : (
                    formatNumber(stats?.total_users)
                  )}
                </div>
                <div className="flex items-center text-xs text-slate-500 mt-1 font-medium">
                    Unique users tracked
                </div>
            </CardContent>
            </Card>
        </motion.div>
        
        <motion.div variants={item}>
            <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Data Events</CardTitle>
                <Database size={20} className="text-purple-500" weight="duotone" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {loading ? (
                    <CircleNotch size={24} className="animate-spin text-slate-400" />
                  ) : (
                    formatNumber(stats?.total_events)
                  )}
                </div>
                <div className="flex items-center text-xs text-slate-500 mt-1 font-medium">
                    Processed by AI Worker
                </div>
            </CardContent>
            </Card>
        </motion.div>
        
        <motion.div variants={item}>
            <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">Avg. Quality</CardTitle>
                <Activity size={20} className="text-amber-500" weight="duotone" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {loading ? (
                    <CircleNotch size={24} className="animate-spin text-slate-400" />
                  ) : (
                    `${((stats?.average_quality ?? 0) * 100).toFixed(1)}%`
                  )}
                </div>
                <div className="flex items-center text-xs text-slate-500 mt-1 font-medium">
                    Human-verified data quality
                </div>
            </CardContent>
            </Card>
        </motion.div>
      </motion.div>

      {/* Live Section (Phase 4 — Realtime) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 glass-panel border-0 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">
                Live Ingest (last 60s)
              </CardTitle>
              <p className="text-sm text-slate-500">
                Each tick is a scored event pushed straight from the server.
              </p>
            </div>
            <RealtimeStatusBadge />
          </CardHeader>
          <CardContent>
            <LiveChart />
          </CardContent>
        </Card>

        <div className="col-span-3">
          <ShakeFeed />
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Revenue Chart */}
        <Card className="col-span-4 glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-800">Overview</CardTitle>
            <p className="text-sm text-slate-500">Real data will appear once events are processed.</p>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={generateChartData(stats?.total_payouts || 0)}>
                        <defs>
                            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis 
                            dataKey="name" 
                            stroke="#888888" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                        />
                        <YAxis 
                            stroke="#888888" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `$${value}`} 
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                                borderRadius: '12px', 
                                border: 'none', 
                                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' 
                            }} 
                        />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <Area 
                            type="monotone" 
                            dataKey="earnings" 
                            stroke="#3B82F6" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorEarnings)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Recent Applications */}
        <Card className="col-span-3 glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-800">Your Applications</CardTitle>
            <p className="text-sm text-slate-500">
              {loading ? 'Loading...' : `${apps.length} registered application${apps.length !== 1 ? 's' : ''}`}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <CircleNotch size={24} className="animate-spin text-slate-400" />
                </div>
              ) : apps.length > 0 ? (
                apps.slice(0, 5).map((app, i) => (
                  <motion.div 
                    key={app.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }} 
                    className="flex items-center group cursor-pointer p-3 rounded-xl hover:bg-slate-50/80 transition-all border border-transparent hover:border-slate-100"
                  >
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-100 text-blue-500">
                      <Key size={20} weight="duotone" />
                    </div>
                    <div className="ml-4 space-y-1 flex-1">
                      <p className="text-sm font-bold leading-none text-slate-800 group-hover:text-primary transition-colors">{app.name}</p>
                      <p className="text-xs text-slate-500">
                        {app.is_active ? 'Active' : 'Inactive'} • Created {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={app.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                      {app.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <ArrowRight className="ml-2 text-slate-300 group-hover:text-primary transition-colors" size={16} />
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Code size={24} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">No applications yet</p>
                  <p className="text-xs text-slate-400 mt-1">Create your first app to get started</p>
                  <Link href="/dashboard/my-apps">
                    <Button size="sm" className="mt-4">
                      <Plus size={14} className="mr-1" /> Create App
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
