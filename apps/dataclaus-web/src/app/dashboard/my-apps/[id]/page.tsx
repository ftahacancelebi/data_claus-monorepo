'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft,
  Activity,
  Users,
  Database,
  Clock,
  TrendUp,
  TrendDown,
  Gear,
  ShieldCheck,
  Lightning,
  Globe,
  DeviceMobile,
  CheckCircle,
  Warning,
  Copy,
  Eye,
  EyeSlash,
  ChartBar,
  Wallet,
  Percent,
  Coins
} from 'phosphor-react';
import {
  useApplication,
  useApplicationStats,
  useWalletsByOwner,
  useWalletTransactions,
} from '@/lib/api-hooks';
import { DeveloperRevenueFlow } from '@/components/apps/developer-revenue-flow';

export default function AppDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const appId = params.id as string;

  const appQuery = useApplication(appId);
  const statsQuery = useApplicationStats(appId);
  const walletsQuery = useWalletsByOwner(user?.id);
  const primaryWalletId = walletsQuery.data?.[0]?.id;
  const txQuery = useWalletTransactions(primaryWalletId, { limit: 10, offset: 0 });

  const transactions = txQuery.data ?? [];
  const loading = appQuery.isLoading || statsQuery.isLoading;
  const error =
    appQuery.error?.message ??
    statsQuery.error?.message ??
    (!appQuery.data && !appQuery.isLoading ? 'Application not found' : null);

  // Augment server data with hardcoded UI metadata (chart placeholders, services
  // config, masked API-key display). The API doesn't return time-series yet, so
  // chart data is zeroed; replace when /applications/:id/timeseries lands.
  const app = useMemo(() => {
    if (!appQuery.data || !statsQuery.data) return null;
    const appData = appQuery.data;
    const statsData = statsQuery.data;
    return {
      ...appData,
      apiKey: appData.api_key_prefix
        ? `${appData.api_key_prefix}••••••••`
        : 'No API Key',
      platform: 'DataClaus SDK',
      stats: {
        totalEvents: statsData.total_events,
        activeUsers: statsData.total_users,
        avgLatency: 24,
        qualityScore: statsData.avg_quality,
        revenue: statsData.total_revenue,
        todayEvents: statsData.events_today,
      },
      trafficData: [
        { time: '00:00', events: 0 },
        { time: '06:00', events: 0 },
        { time: '12:00', events: 0 },
        { time: '18:00', events: 0 },
        { time: '23:59', events: 0 },
      ],
      weeklyData: [
        { day: 'Mon', events: 0, users: 0 },
        { day: 'Tue', events: 0, users: 0 },
        { day: 'Wed', events: 0, users: 0 },
        { day: 'Thu', events: 0, users: 0 },
        { day: 'Fri', events: 0, users: 0 },
        { day: 'Sat', events: 0, users: 0 },
        { day: 'Sun', events: 0, users: 0 },
      ],
      services: [
        { id: 'recaptcha', name: 'reCAPTCHA v3', description: 'Bot protection and human verification', enabled: true, icon: ShieldCheck },
        { id: 'quality', name: 'Quality Scoring', description: 'AI-powered data quality assessment', enabled: true, icon: ChartBar },
        { id: 'realtime', name: 'Real-time Analytics', description: 'Live dashboard and metrics', enabled: true, icon: Activity },
      ],
    };
  }, [appQuery.data, statsQuery.data]);

  if (!user) return null;
  if (loading) {
     return (
        <div className="flex h-screen items-center justify-center">
            <div className="text-center">
               <Activity size={32} className="mx-auto text-blue-600 animate-spin mb-4" />
               <p className="text-slate-500">Loading application...</p>
            </div>
        </div>
     );
  }

  if (error || !app) {
     return (
        <div className="p-8 text-center">
           <h2 className="text-xl font-bold text-slate-800 mb-2">Error</h2>
           <p className="text-red-600 mb-4">{error || 'Application not found'}</p>
           <Button onClick={() => router.back()}>Go Back</Button>
        </div>
     );
  }

  const copyApiKey = () => {
    const key = app?.api_key_prefix ?? '';
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-500">
            <ArrowLeft size={20} className="mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-slate-200"></div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{app.name}</h1>
              <Badge className={app.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500'}>
                {app.is_active ? <CheckCircle size={12} className="mr-1" weight="fill" /> : <Warning size={12} className="mr-1" />}
                {app.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-slate-500 text-sm mt-1">{app.category || 'Uncategorized'} • {app.platform}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">
            <Gear size={18} className="mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* API Key Card */}
      <Card className="glass-panel border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck size={24} className="text-primary" weight="duotone" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">API Key</h3>
                <p className="text-sm text-slate-500">
                  Full key is shown only once at creation — prefix identifies this key
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-mono text-slate-700 tracking-widest min-w-[220px] text-center">
                {showApiKey
                  ? `${app.api_key_prefix ?? 'N/A'}••••••••`
                  : '•••••••••••••••••••••••••'}
              </code>
              <button
                onClick={() => setShowApiKey((v) => !v)}
                className="h-9 w-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                title={showApiKey ? 'Hide key' : 'Reveal prefix'}
              >
                {showApiKey ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
              <button
                onClick={copyApiKey}
                className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                  copied
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700'
                }`}
                title="Copy prefix"
              >
                {copied ? <CheckCircle size={16} weight="fill" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Activity size={20} className="text-blue-500" weight="duotone" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{app.stats.totalEvents.toLocaleString()}</p>
              <p className="text-sm text-slate-500">Total Events</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users size={20} className="text-purple-500" weight="duotone" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{app.stats.activeUsers.toLocaleString()}</p>
              <p className="text-sm text-slate-500">Users</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock size={20} className="text-amber-500" weight="duotone" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{app.stats.avgLatency}ms</p>
              <p className="text-sm text-slate-500">Avg Latency</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendUp size={20} className="text-emerald-500" weight="duotone" />
              </div>
              <p className="text-2xl font-bold text-emerald-600">${app.stats.revenue.toLocaleString()}</p>
              <p className="text-sm text-slate-500">Gross Revenue</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Revenue Flow Section */}
      <DeveloperRevenueFlow
        userSharePercent={app.user_share_percent || 70}
        platformFee={5}
        grossRevenue={app.stats.revenue}
        totalEvents={app.stats.totalEvents}
        totalUsers={app.stats.activeUsers}
        transactions={transactions}
      />

       {/* Services */}
       <Card className="glass-panel border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900">Services & Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {app.services.map((service: any) => {
              const Icon = service.icon;
              return (
                <div 
                  key={service.id}
                  className={`p-4 rounded-xl border transition-all ${
                    service.enabled 
                      ? 'bg-white border-slate-200 shadow-sm' 
                      : 'bg-slate-50/50 border-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      service.enabled ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Icon size={20} weight="duotone" />
                    </div>
                    <Badge className={service.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                      {service.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <h4 className={`font-semibold mb-1 ${service.enabled ? 'text-slate-900' : 'text-slate-500'}`}>
                    {service.name}
                  </h4>
                  <p className="text-sm text-slate-500">{service.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
