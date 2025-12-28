'use client';

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
    Gift
} from 'phosphor-react';

// Mock Data
const earningsData = [
  { name: 'Week 1', value: 2.50 },
  { name: 'Week 2', value: 4.20 },
  { name: 'Week 3', value: 3.80 },
  { name: 'Week 4', value: 6.50 },
];

const recentActivity = [
  { id: '1', app: 'FitTracker', action: 'Data Share', earned: 0.12, time: '2 min ago' },
  { id: '2', app: 'Survey Widget', action: 'Survey Complete', earned: 0.25, time: '15 min ago' },
  { id: '3', app: 'LocationAPI', action: 'Data Stream', earned: 0.08, time: '1 hour ago' },
  { id: '4', app: 'FitTracker', action: 'Data Share', earned: 0.10, time: '3 hours ago' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

interface DashboardProps {
  user: AuthUser;
}

export function UserDashboard({ user }: DashboardProps) {
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
              <div className="text-3xl font-bold text-slate-900">$17.00</div>
              <div className="flex items-center text-xs mt-1 text-emerald-600 font-medium">
                <TrendUp className="mr-1" weight="bold" size={14} />
                +$6.50 this week
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Quality Score
              </CardTitle>
              <Star size={20} className="text-amber-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">98.5%</div>
              <p className="text-xs text-slate-500 mt-1">Excellent data quality</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Apps
              </CardTitle>
              <ShieldCheck size={20} className="text-blue-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">3</div>
              <p className="text-xs text-slate-500 mt-1">Sharing your data</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Data Events
              </CardTitle>
              <Clock size={20} className="text-purple-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">1,247</div>
              <p className="text-xs text-slate-500 mt-1">Total contributions</p>
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
                <AreaChart data={earningsData}>
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

        {/* Recent Activity */}
        <Card className="col-span-3 glass-panel border-0 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-900">Recent Activity</CardTitle>
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
              Live
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={18} className="text-emerald-500" weight="fill" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                      <p className="text-xs text-slate-500">{activity.app} • {activity.time}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">+${activity.earned.toFixed(2)}</span>
                </div>
              ))}
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
              The higher your data quality score, the more you earn. Keep using trusted apps to boost your earnings.
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
