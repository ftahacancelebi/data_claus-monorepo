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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AuthUser } from '@/lib/types';
import { 
    Wallet,
    TrendUp,
    ShieldCheck,
    Clock,
    CheckCircle,
    Star,
    ArrowRight,
    Gift,
    CircleNotch
} from 'phosphor-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

interface UserEarnings {
  userId: string;
  walletId: string | null;
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  currency: string;
}

interface DashboardProps {
  user: AuthUser;
}

export function UserDashboard({ user }: DashboardProps) {
  const [earnings, setEarnings] = useState<UserEarnings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEarnings() {
      try {
        const token = localStorage.getItem('dataclaus_token');
        const response = await fetch(`/api/users/${user.id}/earnings`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setEarnings(data.data || data);
        }
      } catch (err) {
        console.error('Failed to fetch earnings:', err);
      } finally {
        setLoading(false);
      }
    }
    
    if (user?.id) {
      fetchEarnings();
    }
  }, [user?.id]);

  // Generate chart data from earnings
  const chartData = [
    { name: 'Week 1', value: 0 },
    { name: 'Week 2', value: 0 },
    { name: 'Week 3', value: 0 },
    { name: 'Week 4', value: earnings?.totalEarned || 0 },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back, {user.name}</h2>
          <p className="text-slate-500 mt-1">
             Your data is working for you. Here's what you've earned.
          </p>
        </div>
        <Button className="bg-primary hover:bg-blue-800 text-white shadow-md">
          <Gift weight="duotone" className="mr-2" size={18} />
          Explore Apps
        </Button>
      </div>

      {/* Stats Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Earnings
              </CardTitle>
              <Wallet size={20} className="text-emerald-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? (
                  <CircleNotch size={24} className="animate-spin text-slate-400" />
                ) : (
                  `$${(earnings?.totalEarned || 0).toFixed(4)}`
                )}
              </div>
              <div className="flex items-center text-xs mt-1 text-emerald-600 font-medium">
                <TrendUp className="mr-1" weight="bold" size={14} />
                Real-time from blockchain
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pending Balance
              </CardTitle>
              <Clock size={20} className="text-amber-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? (
                  <CircleNotch size={24} className="animate-spin text-slate-400" />
                ) : (
                  `$${(earnings?.pendingBalance || 0).toFixed(4)}`
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Awaiting payout</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Available Balance
              </CardTitle>
              <ShieldCheck size={20} className="text-blue-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? (
                  <CircleNotch size={24} className="animate-spin text-slate-400" />
                ) : (
                  `$${(earnings?.balance || 0).toFixed(4)}`
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Ready to withdraw</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Quality Score
              </CardTitle>
              <Star size={20} className="text-purple-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">50%</div>
              <p className="text-xs text-slate-500 mt-1">Default score</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-7">
        {/* Earnings Chart */}
        <Card className="col-span-4 glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Earnings Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="userEarningGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} fill="url(#userEarningGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="col-span-3 glass-panel border-0 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-900">How You Earn</CardTitle>
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
              Active
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-emerald-500" weight="fill" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Watch Rewarded Ads</p>
                    <p className="text-xs text-slate-500">$0.015 per view</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-600">70% share</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-emerald-500" weight="fill" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">View Banner Ads</p>
                    <p className="text-xs text-slate-500">$0.002 per view</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-600">70% share</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle size={18} className="text-emerald-500" weight="fill" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Interstitial Ads</p>
                    <p className="text-xs text-slate-500">$0.007 per view</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-emerald-600">70% share</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA Section */}
      <Card className="bg-gradient-to-r from-primary to-blue-700 text-white border-0">
        <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold mb-2">Earn more with quality data</h3>
            <p className="text-blue-100 max-w-md">
              Use apps with DataClaus integration to automatically earn money when you view ads.
            </p>
          </div>
          <Button className="bg-white text-primary hover:bg-blue-50 font-semibold">
            Learn More
            <ArrowRight className="ml-2" size={18} />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
