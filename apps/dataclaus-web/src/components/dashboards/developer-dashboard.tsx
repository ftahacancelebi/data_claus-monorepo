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

      {/* Unified Stats Group */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="w-full"
      >
        <Card className="glass-panel border border-slate-200/60 shadow-xl overflow-hidden flex flex-col p-0 rounded-2xl bg-white relative">
          <div className="grid grid-cols-1 md:grid-cols-4 z-10 pt-2">
            
            {/* Col 1 */}
            <div className="px-6 py-6 md:border-r border-dashed border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <CurrencyDollar size={22} weight="regular" className="text-slate-600" />
                </div>
                <div className="text-sm font-medium text-slate-500 mb-2">Total Payouts</div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="text-3xl font-bold text-slate-900 tracking-tight">
                    {loading ? <CircleNotch size={24} className="animate-spin text-slate-400" /> : `$${stats?.total_payouts?.toLocaleString() ?? '0'}`}
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide">
                     <TrendUp size={12} className="mr-1 inline" weight="bold" /> 12%
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
                Real-time from ledger across all active campaigns
              </div>
            </div>
            
            {/* Col 2 */}
            <div className="px-6 py-6 md:border-r border-dashed border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <Users size={22} weight="regular" className="text-slate-600" />
                </div>
                <div className="text-sm font-medium text-slate-500 mb-2">Total Users</div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="text-3xl font-bold text-slate-900 tracking-tight">
                    {loading ? <CircleNotch size={24} className="animate-spin text-slate-400" /> : formatNumber(stats?.total_users)}
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide">
                     <TrendUp size={12} className="mr-1 inline" weight="bold" /> 8%
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
                Unique active users tracked to date across the platform
              </div>
            </div>

            {/* Col 3 */}
            <div className="px-6 py-6 md:border-r border-dashed border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <Database size={22} weight="regular" className="text-slate-600" />
                </div>
                <div className="text-sm font-medium text-slate-500 mb-2">Data Events</div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="text-3xl font-bold text-slate-900 tracking-tight">
                    {loading ? <CircleNotch size={24} className="animate-spin text-slate-400" /> : formatNumber(stats?.total_events)}
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide">
                     <TrendUp size={12} className="mr-1 inline" weight="bold" /> 24%
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
                Processed successfully by the AI Worker nodes
              </div>
            </div>

            {/* Col 4 */}
            <div className="px-6 py-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <Activity size={22} weight="regular" className="text-slate-600" />
                </div>
                <div className="text-sm font-medium text-slate-500 mb-2">Avg. Quality</div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="text-3xl font-bold text-slate-900 tracking-tight">
                    {loading ? <CircleNotch size={24} className="animate-spin text-slate-400" /> : `${((stats?.average_quality ?? 0) * 100).toFixed(1)}%`}
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 px-1.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide">
                     <TrendUp size={12} className="mr-1 inline" weight="bold" /> 2%
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
                Human-verified quality based on latest model evaluation
              </div>
            </div>

          </div>

          {/* Bottom Area Chart */}
          <div className="h-[100px] w-full mt-2 -mb-1 z-0">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={generateChartData(stats?.total_payouts || 0)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                   <Area 
                       type="monotone" 
                       dataKey="earnings" 
                       stroke="none" 
                       fillOpacity={1} 
                       fill="#2563eb" 
                       isAnimationActive={false}
                   />
                </AreaChart>
             </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>


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
