'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AuthUser } from '@/lib/types';
import { 
    ShoppingCart,
    Database,
    Users,
    Plus,
    Lightning,
} from 'phosphor-react';

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
              <div className="text-3xl font-bold text-slate-900">$0.00</div>
              <p className="text-xs text-slate-500 mt-1">No campaigns yet</p>
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
              <div className="text-3xl font-bold text-slate-900">0</div>
              <p className="text-xs text-slate-500 mt-1">Start a campaign to acquire data</p>
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
              <div className="text-3xl font-bold text-emerald-600">-</div>
              <p className="text-xs text-slate-500 mt-1">No data yet</p>
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
              <div className="text-3xl font-bold text-slate-900">0</div>
              <p className="text-xs text-slate-500 mt-1">Data providers</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Empty State */}
      <Card className="glass-panel border-0 shadow-xl">
        <CardContent className="py-16">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Database size={32} className="text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Campaigns</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              Create your first data acquisition campaign to start purchasing high-quality, verified data from our marketplace.
            </p>
            <Button className="bg-primary hover:bg-blue-800 text-white shadow-md">
              <Plus weight="bold" className="mr-2" size={18} />
              Create Your First Campaign
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
