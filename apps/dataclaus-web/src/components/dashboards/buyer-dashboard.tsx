'use client';

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
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AuthUser } from '@/lib/types';
import { 
    ShoppingCart,
    TrendUp,
    Database,
    Users,
    Target,
    Plus,
    ChartBar,
    Lightning,
    ArrowRight
} from 'phosphor-react';

// Mock Data
const campaignData = [
  { name: 'Week 1', spend: 2400, records: 12000 },
  { name: 'Week 2', spend: 1800, records: 9000 },
  { name: 'Week 3', spend: 3200, records: 16000 },
  { name: 'Week 4', spend: 2800, records: 14000 },
];

const dataQualityBreakdown = [
  { quality: 'Premium (95%+)', records: 42000, color: '#10B981' },
  { quality: 'High (85-95%)', records: 28000, color: '#3B82F6' },
  { quality: 'Standard (75-85%)', records: 15000, color: '#8B5CF6' },
];

const activeCampaigns = [
  { id: '1', name: 'Q4 Training Data', status: 'active', budget: 5000, spent: 3200, records: 16000 },
  { id: '2', name: 'User Behavior Analysis', status: 'active', budget: 2500, spent: 1800, records: 9000 },
  { id: '3', name: 'Location Intelligence', status: 'paused', budget: 1000, spent: 450, records: 2250 },
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

export function BuyerDashboard({ user }: DashboardProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Data Acquisition Hub</h2>
          <p className="text-slate-500 mt-1">
             Acquire verified, high-quality training data at scale.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50">
            <Database size={18} className="mr-2" />
            Browse Marketplace
          </Button>
          <Button className="bg-primary hover:bg-blue-800 text-white shadow-md">
            <Plus weight="bold" className="mr-2" size={18} />
            New Campaign
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
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Spend
              </CardTitle>
              <ShoppingCart size={20} className="text-purple-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">$10,200</div>
              <div className="flex items-center text-xs mt-1 text-blue-600 font-medium">
                <TrendUp className="mr-1" weight="bold" size={14} />
                3 active campaigns
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Records Acquired
              </CardTitle>
              <Database size={20} className="text-blue-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">85,000</div>
              <p className="text-xs text-slate-500 mt-1">Avg $0.12 per record</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Avg. Quality
              </CardTitle>
              <Lightning size={20} className="text-amber-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">92.4%</div>
              <p className="text-xs text-slate-500 mt-1">Verified human data</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Sources
              </CardTitle>
              <Users size={20} className="text-emerald-500" weight="duotone" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">1,247</div>
              <p className="text-xs text-slate-500 mt-1">Unique data providers</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-7">
        <Card className="col-span-4 glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ChartBar size={20} className="text-primary" />
              Acquisition Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
                    }}
                  />
                  <Bar yAxisId="left" dataKey="spend" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="records" fill="#10B981" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-primary"></div>
                <span className="text-xs text-slate-600">Spend ($)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-emerald-500"></div>
                <span className="text-xs text-slate-600">Records</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Quality Breakdown */}
        <Card className="col-span-3 glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Quality Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dataQualityBreakdown.map((tier) => (
                <div key={tier.quality} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">{tier.quality}</span>
                    <span className="text-sm text-slate-500">{(tier.records / 1000).toFixed(0)}k records</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${(tier.records / 85000) * 100}%`,
                        backgroundColor: tier.color
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-3">
                <Lightning size={24} className="text-emerald-600" weight="fill" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Premium Data Available</p>
                  <p className="text-xs text-emerald-600">42,000 verified premium records ready for acquisition</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Campaigns */}
      <Card className="glass-panel border-0 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Target size={20} className="text-purple-500" />
            Active Campaigns
          </CardTitle>
          <Button variant="outline" size="sm">
            View All
            <ArrowRight size={16} className="ml-2" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeCampaigns.map((campaign) => (
              <div key={campaign.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`h-3 w-3 rounded-full ${campaign.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                  <div>
                    <p className="font-semibold text-slate-900">{campaign.name}</p>
                    <p className="text-xs text-slate-500">{campaign.records.toLocaleString()} records acquired</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">${campaign.spent.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">of ${campaign.budget.toLocaleString()}</p>
                  </div>
                  <div className="w-24">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(campaign.spent / campaign.budget) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <Badge className={campaign.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                    {campaign.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
