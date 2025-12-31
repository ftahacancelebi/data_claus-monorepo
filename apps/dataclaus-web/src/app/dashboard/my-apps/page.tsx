'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { REVENUE_SHARES, ApiKey } from '@/lib/types';
import { Slider } from '@/components/ui/slider';
import { 
    Plus, 
    Code, 
    Users, 
    CurrencyDollar, 
    AppWindow,
    X,
    MagnifyingGlass,
    CheckCircle,
    Heart,
    GameController,
    ShoppingCart,
    Airplane,
    Briefcase,
    ChartBar,
    Flask,
    MusicNote,
    Camera,
    Book,
    Wallet,
    ArrowRight,
    Activity,
    TrendUp,
    Lightning,
    Key,
    Copy,
    Warning,
    CircleNotch,
    Info
} from 'phosphor-react';
import { getApplications, createApplication, getDashboard, DashboardStats, Application } from '@/lib/api';

// Categories with icons
const categories = [
  { id: 'health', name: 'Health & Fitness', icon: Heart },
  { id: 'gaming', name: 'Gaming', icon: GameController },
  { id: 'ecommerce', name: 'E-Commerce', icon: ShoppingCart },
  { id: 'travel', name: 'Travel', icon: Airplane },
  { id: 'business', name: 'Business', icon: Briefcase },
  { id: 'analytics', name: 'Analytics', icon: ChartBar },
  { id: 'research', name: 'Research', icon: Flask },
  { id: 'entertainment', name: 'Entertainment', icon: MusicNote },
  { id: 'social', name: 'Social Media', icon: Camera },
  { id: 'education', name: 'Education', icon: Book },
  { id: 'finance', name: 'Finance', icon: Wallet },
];

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
};

export default function MyAppsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Real data from API
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAppApiKey, setNewAppApiKey] = useState<string | null>(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    userSharePercent: 70, // Default 70% to users
  });

  // Fetch applications from backend
  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch applications for this developer
        const applications = await getApplications(user.id);
        setApps(applications || []);
        
        // Fetch dashboard stats
        const dashboardStats = await getDashboard();
        setStats(dashboardStats);
      } catch (err) {
        console.error('Failed to fetch apps:', err);
        setError('Failed to load applications. Make sure the backend is running.');
        // Keep page usable with empty data
        setApps([]);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [user?.id]);

  if (!user) return null;

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Please enter an app name', variant: 'destructive' });
      return;
    }
    
    setCreating(true);
    setNewAppApiKey(null);
    
    try {
      // Create application (returns app with API key)
      const result = await createApplication(user.id, {
        name: form.name,
        description: form.description,
        category: form.category,
        user_share_percent: form.userSharePercent,
      });
      
      // Add to local state
      setApps([result, ...apps]);
      
      // Store the API key to show to user
      if (result.api_key) {
        setNewAppApiKey(result.api_key);
        toast({
          title: 'Application Created! 🎉',
          description: 'Your API key has been generated. Copy it now!',
        });
      } else {
        setForm({ name: '', description: '', category: '', userSharePercent: 70 });
        setShowModal(false);
        toast({ title: 'Application Created! 🎉' });
      }
    } catch (err) {
      console.error('Failed to create app:', err);
      toast({
        title: 'Failed to create application',
        description: 'Make sure the backend server is running.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: 'API Key copied!' });
  };

  const closeModal = () => {
    setShowModal(false);
    setForm({ name: '', description: '', category: '', userSharePercent: 70 });
    setNewAppApiKey(null);
  };

  const activeApps = apps.filter(app => app.is_active).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Applications</h1>
          <p className="text-slate-500 mt-1">
            Manage your integrated applications and API keys.
          </p>
        </div>
        <Button 
            onClick={() => setShowModal(true)} 
            className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 transition-all font-medium"
        >
          <Plus weight="bold" className="mr-2" />
          Create New App
        </Button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Warning size={20} className="text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">{error}</p>
            <p className="text-sm text-amber-600 mt-1">
              Run `docker-compose up -d` and `go run apps/dataclaus-api/cmd/api` to start the backend.
            </p>
          </div>
        </div>
      )}

      {/* ========== STATISTICS SECTION ========== */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ChartBar size={20} className="text-slate-400" weight="duotone" />
          <h2 className="text-lg font-semibold text-slate-700">Statistics Overview</h2>
        </div>
        
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-4 md:grid-cols-4"
        >
          {/* Total Apps */}
          <motion.div variants={item}>
            <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <AppWindow size={20} className="text-blue-600" weight="duotone" />
                  </div>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Apps</p>
                <p className="text-3xl font-bold text-slate-900">{loading ? '-' : apps.length}</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Active Apps */}
          <motion.div variants={item}>
            <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Activity size={20} className="text-emerald-600" weight="duotone" />
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    <Lightning size={10} className="mr-1" weight="fill" />
                    Live
                  </Badge>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Active Apps</p>
                <p className="text-3xl font-bold text-slate-900">{loading ? '-' : activeApps}</p>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Total Events */}
          <motion.div variants={item}>
            <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center">
                    <Users size={20} className="text-purple-600" weight="duotone" />
                  </div>
                  {stats && (
                    <span className="flex items-center text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      <TrendUp size={10} className="mr-1" weight="bold" />Live
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Events</p>
                <p className="text-3xl font-bold text-slate-900">{stats?.total_events?.toLocaleString() ?? '-'}</p>
              </CardContent>
            </Card>
          </motion.div>
          
          {/* Total Payouts */}
          <motion.div variants={item}>
            <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <CurrencyDollar size={20} className="text-slate-700" weight="duotone" />
                  </div>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Payouts</p>
                <p className="text-3xl font-bold text-slate-900">${stats?.total_payouts?.toLocaleString() ?? '0'}</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </section>

      {/* ========== APPLICATIONS SECTION ========== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key size={20} className="text-slate-400" weight="duotone" />
            <h2 className="text-lg font-semibold text-slate-700">Your Applications (API Keys)</h2>
            <Badge variant="outline" className="ml-2 text-xs">{apps.length} apps</Badge>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <CircleNotch size={32} className="text-primary animate-spin" />
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {apps.map((app, index) => (
              <motion.div 
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all h-full group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
                        <Code size={22} weight="duotone" />
                      </div>
                      <Badge className={
                        app.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }>
                        {app.is_active && <Activity size={10} className="mr-1" weight="fill" />}
                        {app.is_active ? 'active' : 'inactive'}
                      </Badge>
                    </div>

                    <h3 className="font-bold text-lg text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{app.name}</h3>
                    <p className="text-sm text-slate-500 mb-4">{app.description || 'Your SDK integration app'}</p>
                    
                    {/* API Key Preview */}
                    {app.api_key_prefix && (
                      <div className="p-3 bg-slate-100 rounded-lg mb-4">
                        <div className="flex items-center justify-between">
                          <code className="text-xs text-slate-600 font-mono">{app.api_key_prefix}••••••••</code>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => copyApiKey(app.api_key_prefix || '')}
                            className="h-7 w-7 p-0"
                          >
                            <Copy size={14} />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 mb-4 pb-4 border-b border-slate-100">
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">{app.total_events.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">Events</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-900">{app.total_users.toLocaleString()}</p>
                        <p className="text-xs text-slate-400">Users</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-emerald-600">${app.total_revenue.toFixed(2)}</p>
                        <p className="text-xs text-slate-400">Revenue</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/my-apps/${app.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full hover:bg-slate-50">
                          View Details
                          <ArrowRight size={14} className="ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Empty State / Create New Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: apps.length * 0.08 }}
            >
              <Card 
                className="border-2 border-dashed border-slate-200 hover:border-blue-300 bg-slate-50/50 hover:bg-blue-50/30 transition-all h-full cursor-pointer group"
                onClick={() => setShowModal(true)}
              >
                <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[280px]">
                  <div className="h-14 w-14 rounded-2xl bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center mb-4 transition-colors">
                    <Plus size={28} className="text-slate-400 group-hover:text-blue-600 transition-colors" weight="bold" />
                  </div>
                  <h3 className="font-semibold text-slate-600 group-hover:text-blue-700 transition-colors mb-1">Create New App</h3>
                  <p className="text-sm text-slate-400 text-center">Register a new application to get an API key</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </section>

      {/* Create App Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              style={{ zIndex: 99999 }}
              onClick={() => setShowModal(false)}
            />
            
            {/* Modal Container */}
            <div 
              className="fixed inset-0 flex items-center justify-center p-4"
              style={{ zIndex: 100000 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  {/* Header */}
                  <div className="relative h-24 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 flex items-center px-8">
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute top-[-50%] right-[-20%] w-[60%] h-[200%] bg-blue-500/10 rotate-12"></div>
                    </div>
                    <div className="relative flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                        <Plus size={24} className="text-white" weight="bold" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Create New Application</h2>
                        <p className="text-slate-300 text-sm">Generate a new API key for your app</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowModal(false)}
                      className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                    >
                      <X size={16} weight="bold" />
                    </button>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* App Name */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Application Name *</Label>
                      <Input 
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="My Awesome App"
                        className="h-11"
                        required
                      />
                      <p className="text-xs text-slate-500">This will be the name of your API key</p>
                    </div>

                    {/* Category (optional) */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Category (optional)</Label>
                      <div className="relative">
                        <MagnifyingGlass className="absolute left-3 top-3 text-slate-400" size={18} />
                        <Input 
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          placeholder="Search categories..."
                          className="h-11 pl-10 mb-3"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 max-h-[140px] overflow-y-auto p-1">
                        {filteredCategories.slice(0, 9).map((cat) => {
                          const Icon = cat.icon;
                          const isSelected = form.category === cat.name;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setForm({ ...form, category: cat.name })}
                              className={`p-2 rounded-xl border transition-all flex flex-col items-center text-center gap-1 ${
                                isSelected 
                                  ? 'border-blue-500 bg-blue-50' 
                                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                                isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                              }`}>
                                <Icon size={14} weight={isSelected ? 'fill' : 'duotone'} />
                              </div>
                              <span className={`text-[10px] font-medium ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                                {cat.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Revenue Share Configuration */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-slate-700">Revenue Share Distribution</Label>
                        <Badge variant="outline" className="text-xs font-normal">
                          Configurable per app
                        </Badge>
                      </div>
                      
                      {/* Slider */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-slate-500 w-24">User Share</span>
                          <div className="flex-1">
                            <Slider
                              value={[form.userSharePercent]}
                              onValueChange={(value) => setForm({ ...form, userSharePercent: value[0] })}
                              min={50}
                              max={90}
                              step={5}
                              className="cursor-pointer"
                            />
                          </div>
                          <span className="text-lg font-bold text-emerald-600 w-16 text-right">{form.userSharePercent}%</span>
                        </div>
                        
                        {/* Visual breakdown */}
                        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="text-center">
                            <div className="h-2 rounded-full bg-emerald-500 mb-2" style={{ width: `${form.userSharePercent}%`, minWidth: '20%' }} />
                            <p className="text-xl font-bold text-emerald-600">{form.userSharePercent}%</p>
                            <p className="text-xs text-slate-500">User Earnings</p>
                          </div>
                          <div className="text-center">
                            <div className="h-2 rounded-full bg-blue-500 mb-2" style={{ width: `${100 - 5 - form.userSharePercent}%`, minWidth: '10%' }} />
                            <p className="text-xl font-bold text-blue-600">{100 - 5 - form.userSharePercent}%</p>
                            <p className="text-xs text-slate-500">Your Revenue</p>
                          </div>
                          <div className="text-center">
                            <div className="h-2 rounded-full bg-slate-400 mb-2 w-[20%]" />
                            <p className="text-xl font-bold text-slate-600">5%</p>
                            <p className="text-xs text-slate-500">Platform Fee</p>
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Info size={12} />
                          Higher user share attracts more users but reduces your margins
                        </p>
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-sm text-blue-800">
                        <strong>Important:</strong> After creation, you'll receive an API key. 
                        Copy it immediately - you won't be able to see it again!
                      </p>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setShowModal(false)}
                        className="flex-1"
                        disabled={creating}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
                        disabled={creating}
                      >
                        {creating ? (
                          <>
                            <CircleNotch size={16} className="mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Application'
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
