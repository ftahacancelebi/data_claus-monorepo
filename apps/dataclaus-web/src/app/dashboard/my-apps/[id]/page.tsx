'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
} from 'recharts';
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
import { getApplication, getApplicationStats } from '@/lib/api';

export default function AppDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const appId = params.id as string;

  useEffect(() => {
    async function fetchData() {
      if (!appId || !user) return;
      
      setLoading(true);
      try {
        const appData = await getApplication(appId);
        const statsData = await getApplicationStats(appId);
        
        setApp({
          ...appData,
          apiKey: appData.api_key_prefix ? `${appData.api_key_prefix}••••••••` : 'No API Key', // We don't have full key here
          platform: 'DataClaus SDK', // hardcoded for now
          stats: {
             totalEvents: statsData.total_events,
             activeUsers: statsData.total_users,
             avgLatency: 24, // Mock
             qualityScore: statsData.avg_quality,
             revenue: statsData.total_revenue,
             todayEvents: statsData.events_today
          },
          // Mocking chart data for now as API doesn't provide time-series yet
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
          ]
        });
      } catch (err) {
        console.error('Failed to load app:', err);
        setError('Failed to load application data.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [appId, user]);

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
    // API key is not fully available here, but we can simulate or show instruction
    // In reality, api key is only shown once on creation.
    // Here we might copy a placeholder or the prefix
    navigator.clipboard.writeText(app.apiKey); 
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck size={24} className="text-primary" weight="duotone" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">API Key Prefix</h3>
                <p className="text-sm text-slate-500">For security, full key is only shown on creation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <code className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-mono text-slate-700">
                {app.apiKey}
              </code>
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

      {/* Revenue Distribution & Impact */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Distribution */}
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Percent size={20} className="text-blue-500" />
              Revenue Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
               <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                        {app.user_share_percent || 70}%
                     </div>
                     <div>
                        <p className="font-semibold text-slate-900">User Share</p>
                        <p className="text-sm text-slate-500">Earned by your users</p>
                     </div>
                  </div>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">High Impact</Badge>
               </div>
               
               <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {100 - 5 - (app.user_share_percent || 70)}%
                     </div>
                     <div>
                        <p className="font-semibold text-slate-900">Developer Share (Net)</p>
                        <p className="text-sm text-slate-500">Your revenue</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="font-bold text-slate-900">
                        ${(app.stats.revenue * (100 - 5 - (app.user_share_percent || 70)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                     </p>
                     <p className="text-xs text-slate-500">Total Net Earned</p>
                  </div>
               </div>

               <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                        5%
                     </div>
                     <div>
                        <p className="font-semibold text-slate-900">Platform Fee</p>
                        <p className="text-sm text-slate-500">DataClaus service fee</p>
                     </div>
                  </div>
               </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Score / Impact */}
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
             <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
               <ChartBar size={20} className="text-purple-500" />
               Quality Impact Score
             </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex flex-col items-center justify-center h-[280px] space-y-4">
                <div className="relative h-40 w-40 flex items-center justify-center">
                   <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 100 100">
                      <circle
                         className="text-slate-100"
                         strokeWidth="8"
                         stroke="currentColor"
                         fill="transparent"
                         r="40"
                         cx="50"
                         cy="50"
                      />
                      <circle
                         className="text-purple-500"
                         strokeWidth="8"
                         strokeDasharray={251.2}
                         strokeDashoffset={251.2 - (251.2 * (app.stats.qualityScore || 50) / 100)}
                         strokeLinecap="round"
                         stroke="currentColor"
                         fill="transparent"
                         r="40"
                         cx="50"
                         cy="50"
                      />
                   </svg>
                   <div className="absolute flex flex-col items-center" style={{ transform: 'none' }}>
                      <span className="text-4xl font-bold text-slate-900">{(app.stats.qualityScore || 50).toFixed(1)}</span>
                      <span className="text-xs text-slate-500">/ 100</span>
                   </div>
                </div>
                <div className="text-center max-w-sm">
                   <p className="font-medium text-slate-900">Excellent Data Quality</p>
                   <p className="text-sm text-slate-500 mt-1">Your application is providing high-quality data streams. This increases eCPM rates and user earnings.</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

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
