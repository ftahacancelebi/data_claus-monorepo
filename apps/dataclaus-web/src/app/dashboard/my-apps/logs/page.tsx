'use client';

import { useState, useEffect } from 'react';
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
  LineChart,
  Line
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { 
    ArrowLeft,
    Activity,
    Clock,
    CheckCircle,
    XCircle,
    Warning,
    Database,
    Lightning
} from 'phosphor-react';
import Link from 'next/link';

// Mock real-time data
const generateMockData = () => {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => ({
    time: `${String(now.getHours() - 23 + i).padStart(2, '0')}:00`,
    events: Math.floor(Math.random() * 500) + 100,
    latency: Math.floor(Math.random() * 30) + 10,
    errors: Math.floor(Math.random() * 10),
  }));
};

const mockLogs = [
  { id: '1', type: 'INGEST', status: 'success', timestamp: '2024-12-27T21:05:32Z', latency: 12, events: 240 },
  { id: '2', type: 'AUTH', status: 'success', timestamp: '2024-12-27T21:05:28Z', latency: 8, events: 1 },
  { id: '3', type: 'RISK_CHECK', status: 'success', timestamp: '2024-12-27T21:05:25Z', latency: 45, events: 240 },
  { id: '4', type: 'INGEST', status: 'warning', timestamp: '2024-12-27T21:05:20Z', latency: 89, events: 180 },
  { id: '5', type: 'INGEST', status: 'success', timestamp: '2024-12-27T21:05:15Z', latency: 15, events: 320 },
  { id: '6', type: 'AUTH', status: 'error', timestamp: '2024-12-27T21:05:10Z', latency: 2, events: 0 },
  { id: '7', type: 'INGEST', status: 'success', timestamp: '2024-12-27T21:05:05Z', latency: 18, events: 156 },
  { id: '8', type: 'RISK_CHECK', status: 'success', timestamp: '2024-12-27T21:05:00Z', latency: 32, events: 156 },
];

export default function AppLogsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(generateMockData());
  const [logs, setLogs] = useState(mockLogs);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new log entry
      const newLog = {
        id: Math.random().toString(36).substr(2, 9),
        type: ['INGEST', 'AUTH', 'RISK_CHECK'][Math.floor(Math.random() * 3)],
        status: Math.random() > 0.1 ? 'success' : Math.random() > 0.5 ? 'warning' : 'error',
        timestamp: new Date().toISOString(),
        latency: Math.floor(Math.random() * 50) + 5,
        events: Math.floor(Math.random() * 300) + 50,
      };
      setLogs(prev => [newLog, ...prev].slice(0, 20));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle size={16} className="text-emerald-500" weight="fill" />;
      case 'warning': return <Warning size={16} className="text-amber-500" weight="fill" />;
      case 'error': return <XCircle size={16} className="text-red-500" weight="fill" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/my-apps">
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
            <ArrowLeft size={18} className="mr-2" />
            Back to Apps
          </Button>
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Application Logs</h1>
            <p className="text-slate-500 mt-1">
              Real-time data flow and system metrics for your application.
            </p>
         </div>
         <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-sm text-slate-500">Live</span>
         </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Events Today</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">24,892</p>
              </div>
              <Database size={24} className="text-primary" weight="duotone" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Latency</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">18ms</p>
              </div>
              <Clock size={24} className="text-blue-500" weight="duotone" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Success Rate</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">99.8%</p>
              </div>
              <CheckCircle size={24} className="text-emerald-500" weight="duotone" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Throughput</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">1.2k/s</p>
              </div>
              <Lightning size={24} className="text-amber-500" weight="duotone" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity size={20} className="text-primary" />
              Event Volume (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E3A8A" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#1E3A8A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
                    }}
                  />
                  <Area type="monotone" dataKey="events" stroke="#1E3A8A" strokeWidth={2} fill="url(#eventGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock size={20} className="text-blue-500" />
              Latency Distribution (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} unit="ms" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)' 
                    }}
                  />
                  <Line type="monotone" dataKey="latency" stroke="#3B82F6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Event Log */}
      <Card className="glass-panel border-0 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-900">Live Event Stream</CardTitle>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            Streaming
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map((log, index) => (
              <motion.div 
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(log.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-primary font-semibold">{log.type}</code>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">{log.events} events</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-slate-700">{log.latency}ms</p>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
