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
import { getApplication, getApplicationStats, listApiKeys, type Application, type ApplicationStats } from '@/lib/api';
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
  Loader
} from 'phosphor-react';

// Fallback chart data when no real data available
const getFallbackTrafficData = () => {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setHours(date.getHours() - (6 - i));
    return {
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      events: 0,
    };
  });
};

const getFallbackWeeklyData = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(day => ({ day, events: 0, users: 0 }));
};

const services = [
  { id: 'recaptcha', name: 'reCAPTCHA v3', description: 'Bot protection and human verification', enabled: true, icon: ShieldCheck },
  { id: 'quality', name: 'Quality Scoring', description: 'AI-powered data quality assessment', enabled: true, icon: ChartBar },
  { id: 'realtime', name: 'Real-time Analytics', description: 'Live dashboard and metrics', enabled: true, icon: Activity },
  { id: 'geo', name: 'Geo Intelligence', description: 'Location-based insights', enabled: false, icon: Globe },
  { id: 'push', name: 'Push Notifications', description: 'Engagement and retention tools', enabled: false, icon: Lightning },
];

export default function AppDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [app, setApp] = useState<Application | null>(null);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const appId = params.id as string;

  useEffect(() => {
    async function fetchData() {
      if (!appId || !user?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch application and stats in parallel
        const [appData, statsData] = await Promise.all([
          getApplication(appId).catch(() => null),
          getApplicationStats(appId).catch(() => null),
        ]);
        
        if (!appData) {
          setError('Application not found');
          setLoading(false);
          return;
        }
        
        setApp(appData);
        setStats(statsData);
        
        // Try to get API key for this application
        try {
          const keys = await listApiKeys(user.id);
          const appKey = keys.find(k => k.application_id === appId);
          if (appKey?.key_prefix) {
            setApiKey(appKey.key_prefix + '...');
          }
        } catch (err) {
          // API key not available, that's okay
          console.log('Could not fetch API key:', err);
        }
      } catch (err) {
        console.error('Failed to fetch application data:', err);
        setError('Failed to load application data');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [appId, user?.id]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-slate-500">
          <ArrowLeft size={20} className="mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-600">
              <Warning size={24} />
              <p>{error || 'Application not found'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const copyApiKey = () => {
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
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle size={12} className="mr-1" weight="fill" />
                Active
              </Badge>
            </div>
            <p className="text-slate-500 text-sm mt-1">{app.category} • {app.platform}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">
            <Gear size={18} className="mr-2" />
            Settings
          </Button>
          <Link href="/dashboard/docs">
            <Button className="bg-primary hover:bg-blue-700 text-white">
              View Docs
            </Button>
          </Link>
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
                <h3 className="font-semibold text-slate-900">API Key</h3>
                <p className="text-sm text-slate-500">Use this key to authenticate SDK requests</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <code className="px-4 py-2 bg-slate-100 rounded-lg text-sm font-mono text-slate-700">
                {showApiKey ? app.apiKey : '••••••••••••••••••••••••'}
              </code>
              <Button variant="ghost" size="sm" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeSlash size={18} /> : <Eye size={18} />}
              </Button>
              <Button variant="outline" size="sm" onClick={copyApiKey}>
                {copied ? <CheckCircle size={18} className="text-emerald-500" /> : <Copy size={18} />}
              </Button>
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
                <Badge className="bg-emerald-50 text-emerald-700 text-xs">+12.5%</Badge>
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
                <Badge className="bg-emerald-50 text-emerald-700 text-xs">+8.2%</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{app.stats.activeUsers.toLocaleString()}</p>
              <p className="text-sm text-slate-500">Active Users</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-panel border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Clock size={20} className="text-amber-500" weight="duotone" />
                <Badge className="bg-blue-50 text-blue-700 text-xs">-2ms</Badge>
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
              <p className="text-sm text-slate-500">Total Revenue</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Traffic Chart */}
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity size={20} className="text-blue-500" />
              Today's Traffic
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={app.trafficData}>
                  <defs>
                    <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="events" stroke="#3B82F6" strokeWidth={2} fill="url(#trafficGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Chart */}
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ChartBar size={20} className="text-purple-500" />
              Weekly Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={app.weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="day" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="events" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
            {app.services.map((service) => {
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
                  {!service.enabled && (
                    <Button variant="outline" size="sm" className="mt-3 w-full">
                      Enable
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
