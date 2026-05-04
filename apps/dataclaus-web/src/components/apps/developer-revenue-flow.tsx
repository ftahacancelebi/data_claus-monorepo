'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight,
  CheckCircle,
  DeviceMobile,
  Users,
  Play,
  Coins,
  Wallet,
  TrendUp,
  Lightning,
  ChartBar,
  Gift,
  Receipt,
  ArrowDown,
  ArrowUp,
  Clock,
} from 'phosphor-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  created_at: string;
  status: string;
  reference_id?: string;
}

interface RevenueFlowProps {
  userSharePercent?: number;
  platformFee?: number;
  grossRevenue?: number;
  totalEvents?: number;
  totalUsers?: number;
  transactions?: Transaction[];
}

const flowSteps = [
  {
    id: 1,
    icon: DeviceMobile,
    title: 'User Opens App',
    description: 'A user launches your integrated app',
    color: 'blue',
  },
  {
    id: 2,
    icon: Play,
    title: 'Ad is Displayed',
    description: 'Banner, Interstitial, or Rewarded ad shown',
    color: 'purple',
  },
  {
    id: 3,
    icon: Coins,
    title: 'Revenue Generated',
    description: 'Ad network pays for the impression',
    color: 'amber',
  },
  {
    id: 4,
    icon: ChartBar,
    title: 'Revenue Split',
    description: 'Automatically distributed to all parties',
    color: 'emerald',
  },
];

const adRates = [
  {
    type: 'Banner',
    ecpm: 2.0,
    perImpression: 0.002,
    description: 'Small, non-intrusive ads',
    color: 'blue',
  },
  {
    type: 'Interstitial',
    ecpm: 7.0,
    perImpression: 0.007,
    description: 'Full-screen transition ads',
    color: 'purple',
  },
  {
    type: 'Rewarded',
    ecpm: 15.0,
    perImpression: 0.015,
    description: 'User-initiated reward ads',
    color: 'emerald',
  },
];

export function DeveloperRevenueFlow({
  userSharePercent = 70,
  platformFee = 5,
  grossRevenue = 0,
  totalEvents = 0,
  totalUsers = 0,
  transactions = [],
}: RevenueFlowProps) {
  const devSharePercent = 100 - platformFee - userSharePercent;
  const userEarnings = (grossRevenue * userSharePercent) / 100;
  const devEarnings = (grossRevenue * devSharePercent) / 100;
  const platformEarnings = (grossRevenue * platformFee) / 100;

  return (
    <div className="space-y-6">
      {/* Revenue Flow Visualization */}
      <Card className="glass-panel border-0 shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lightning size={20} className="text-amber-500" weight="fill" />
              How Revenue is Generated
            </CardTitle>
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
              Live Flow
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Flow Steps */}
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {flowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative"
                  >
                    <div className={`p-4 rounded-xl bg-${step.color}-50/50 border border-${step.color}-100 h-full`}
                      style={{
                        backgroundColor: step.color === 'blue' ? 'rgb(239 246 255 / 0.5)' :
                                        step.color === 'purple' ? 'rgb(250 245 255 / 0.5)' :
                                        step.color === 'amber' ? 'rgb(255 251 235 / 0.5)' :
                                        'rgb(236 253 245 / 0.5)',
                        borderColor: step.color === 'blue' ? 'rgb(219 234 254)' :
                                    step.color === 'purple' ? 'rgb(243 232 255)' :
                                    step.color === 'amber' ? 'rgb(254 243 199)' :
                                    'rgb(209 250 229)'
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center`}
                          style={{
                            backgroundColor: step.color === 'blue' ? 'rgb(219 234 254)' :
                                            step.color === 'purple' ? 'rgb(243 232 255)' :
                                            step.color === 'amber' ? 'rgb(254 243 199)' :
                                            'rgb(209 250 229)',
                            color: step.color === 'blue' ? 'rgb(37 99 235)' :
                                  step.color === 'purple' ? 'rgb(147 51 234)' :
                                  step.color === 'amber' ? 'rgb(217 119 6)' :
                                  'rgb(5 150 105)'
                          }}
                        >
                          <Icon size={20} weight="duotone" />
                        </div>
                        <span className="text-xs font-bold text-slate-400">STEP {step.id}</span>
                      </div>
                      <h4 className="font-semibold text-slate-900 mb-1">{step.title}</h4>
                      <p className="text-sm text-slate-500">{step.description}</p>
                    </div>
                    {index < flowSteps.length - 1 && (
                      <div className="hidden md:flex absolute -right-4 top-1/2 transform -translate-y-1/2 z-10">
                        <ArrowRight size={24} className="text-slate-300" weight="bold" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ad Rates & Earnings */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ad Types & Rates */}
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Gift size={20} className="text-purple-500" weight="duotone" />
              Ad Types & eCPM Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {adRates.map((ad) => (
                <motion.div
                  key={ad.type}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl border border-slate-100 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold text-sm`}
                      style={{
                        backgroundColor: ad.color === 'blue' ? 'rgb(219 234 254)' :
                                        ad.color === 'purple' ? 'rgb(243 232 255)' :
                                        'rgb(209 250 229)',
                        color: ad.color === 'blue' ? 'rgb(37 99 235)' :
                              ad.color === 'purple' ? 'rgb(147 51 234)' :
                              'rgb(5 150 105)'
                      }}
                    >
                      ${ad.ecpm}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{ad.type} Ads</p>
                      <p className="text-sm text-slate-500">{ad.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">${ad.perImpression.toFixed(3)}</p>
                    <p className="text-xs text-slate-400">per impression</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Receipt size={20} className="text-emerald-500" weight="duotone" />
              Recent Transactions
            </CardTitle>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
              {totalEvents.toLocaleString()} impressions
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Revenue Summary */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl border border-emerald-100 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Coins size={24} className="text-amber-500" weight="duotone" />
                    <div>
                      <p className="text-sm text-slate-500">Your Net Earnings</p>
                      <p className="text-2xl font-bold text-emerald-700">${devEarnings.toFixed(4)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Gross: ${grossRevenue.toFixed(4)}</p>
                    <p className="text-xs text-emerald-600 font-medium">{devSharePercent}% share</p>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              {transactions.length > 0 ? (
                transactions.slice(0, 5).map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      tx.type === 'ad_revenue' ? 'bg-emerald-50 text-emerald-600' : 
                      tx.type === 'payout' ? 'bg-blue-50 text-blue-600' :
                      tx.type === 'fee' ? 'bg-red-50 text-red-600' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {tx.type === 'ad_revenue' ? <ArrowDown size={18} /> : 
                       tx.type === 'payout' ? <Wallet size={18} /> : 
                       tx.type === 'fee' ? <ArrowUp size={18} /> : 
                       <Receipt size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 capitalize text-sm">
                        {tx.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${
                        tx.type === 'ad_revenue' || tx.type === 'payout' ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        {tx.type === 'fee' ? '-' : '+'}${tx.amount.toFixed(4)}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {tx.status}
                      </Badge>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Clock size={24} className="text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-600">No transactions yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Transactions will appear here when users view ads
                  </p>
                </div>
              )}

              {/* View All Link */}
              {transactions.length > 5 && (
                <div className="pt-3 border-t border-slate-100 text-center">
                  <button className="text-sm text-primary hover:underline font-medium">
                    View all {transactions.length} transactions
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tips Section */}
      <Card className="bg-gradient-to-r from-primary to-blue-700 text-white border-0">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendUp size={24} className="text-white" weight="duotone" />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-1">Maximize Your Revenue</h3>
                <p className="text-blue-100 text-sm">
                  Rewarded ads earn 7.5x more than banner ads. Encourage users to engage with rewarded content!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm bg-white/10 px-4 py-2 rounded-lg">
              <Lightning size={16} weight="fill" className="text-amber-300" />
              <span>Avg eCPM: <strong>$8.00</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
