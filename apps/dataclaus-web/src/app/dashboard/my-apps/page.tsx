'use client';

import { useState, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { PremiumAppCard } from '@/components/ui/premium-app-card';
import { PremiumStatCard } from '@/components/ui/premium-stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
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
  TrendDown,
  Lightning,
  Key,
  Copy,
  Warning,
  CircleNotch,
  Info,
} from 'phosphor-react';
import {
  useApplications,
  useCreateApplication,
  useDashboardStats,
} from '@/lib/api-hooks';

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

const STEP_LABELS = ['App Info', 'Category', 'Revenue', 'Review'];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function MyAppsPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const appsQuery = useApplications(user?.id);
  const statsQuery = useDashboardStats();
  const createMutation = useCreateApplication(user?.id);

  const apps = appsQuery.data ?? [];
  const stats = statsQuery.data ?? null;
  const loading = appsQuery.isLoading;
  const isStaleSession = appsQuery.error?.message?.includes('not found');
  const error = isStaleSession
    ? null
    : appsQuery.error?.message ??
      (appsQuery.error ? 'Failed to load applications. Make sure the backend is running.' : null);
  const creating = createMutation.isPending;

  const [newAppApiKey, setNewAppApiKey] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    userSharePercent: 70,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!user) return null;

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Please enter an app name', variant: 'destructive' });
      return;
    }
    setNewAppApiKey(null);
    try {
      const result = await createMutation.mutateAsync({
        name: form.name,
        description: form.description,
        category: form.category,
        user_share_percent: form.userSharePercent,
      });
      if (result.api_key) {
        setNewAppApiKey(result.api_key);
        toast({
          title: 'Application Created!',
          description: 'Your API key has been generated. Copy it now!',
        });
      } else {
        closeModal();
        toast({ title: 'Application Created!' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('not found')) {
        toast({
          title: 'Session expired',
          description: 'Your developer account was not found. Please log out and log back in.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to create application',
          description: msg || 'Make sure the backend server is running.',
          variant: 'destructive',
        });
      }
    }
  };

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: 'API Key copied!' });
  };

  const closeModal = () => {
    setShowModal(false);
    setStep(1);
    setForm({ name: '', description: '', category: '', userSharePercent: 70 });
    setNewAppApiKey(null);
    setCategorySearch('');
  };

  const activeApps = apps.filter((app) => app.is_active).length;

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Name your application</h3>
              <p className="text-sm text-slate-500">Give your app a recognizable name and description</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Application Name <span className="text-red-400">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My Awesome App"
                className="h-11"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Description{' '}
                <span className="text-slate-400 font-normal text-xs">(optional)</span>
              </Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A brief description of your app..."
                className="h-11"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Choose a category</h3>
              <p className="text-sm text-slate-500">Help users discover your app — optional</p>
            </div>
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-3 text-slate-400" size={16} />
              <Input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories..."
                className="h-10 pl-9"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto pr-1">
              {filteredCategories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = form.category === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setForm({ ...form, category: isSelected ? '' : cat.name })}
                    className={`p-2.5 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon size={16} weight={isSelected ? 'fill' : 'duotone'} />
                    </div>
                    <span
                      className={`text-[10px] font-medium leading-tight text-center ${
                        isSelected ? 'text-blue-700' : 'text-slate-600'
                      }`}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {form.category && (
              <p className="text-xs text-slate-500">
                Selected:{' '}
                <span className="font-medium text-blue-600">{form.category}</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, category: '' })}
                  className="ml-2 text-slate-400 hover:text-slate-600 underline"
                >
                  clear
                </button>
              </p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Revenue distribution</h3>
              <p className="text-sm text-slate-500">
                Set how earnings are split between you and your users
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500 w-24 shrink-0">User Share</span>
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
                <span className="text-lg font-bold text-emerald-600 w-14 text-right shrink-0">
                  {form.userSharePercent}%
                </span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100">
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${form.userSharePercent}%` }}
                />
                <div
                  className="bg-blue-500 transition-all duration-300"
                  style={{ width: `${100 - 5 - form.userSharePercent}%` }}
                />
                <div className="bg-slate-300 flex-1" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <p className="text-2xl font-bold text-emerald-600">{form.userSharePercent}%</p>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">User Earnings</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-2xl font-bold text-blue-600">
                    {100 - 5 - form.userSharePercent}%
                  </p>
                  <p className="text-xs text-blue-700 font-medium mt-0.5">Your Revenue</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-2xl font-bold text-slate-500">5%</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Platform Fee</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Info size={12} />
                Higher user share attracts more users but reduces your margins
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Review & Create</h3>
              <p className="text-sm text-slate-500">
                Confirm your application settings before creating
              </p>
            </div>
            <div className="space-y-2">
              {[
                { label: 'App Name', value: form.name, className: 'text-slate-900' },
                {
                  label: 'Description',
                  value: form.description || '—',
                  className: form.description ? 'text-slate-900' : 'text-slate-400',
                },
                {
                  label: 'Category',
                  value: form.category || '—',
                  className: form.category ? 'text-slate-900' : 'text-slate-400',
                },
                {
                  label: 'User Share',
                  value: `${form.userSharePercent}%`,
                  className: 'text-emerald-600',
                },
                {
                  label: 'Your Revenue',
                  value: `${100 - 5 - form.userSharePercent}%`,
                  className: 'text-blue-600',
                },
                { label: 'Platform Fee', value: '5%', className: 'text-slate-500' },
              ].map(({ label, value, className }) => (
                <div
                  key={label}
                  className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl"
                >
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className={`text-sm font-semibold ${className}`}>{value}</span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
              <Warning size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                After creation, you'll receive an API key.{' '}
                <strong>Copy it immediately</strong> — it won't be shown again.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderSuccess = () => (
    <div className="text-center space-y-5 py-4">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle size={36} className="text-emerald-600" weight="fill" />
        </div>
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Application Created!</h3>
        <p className="text-sm text-slate-500">
          Your API key is ready. Copy it now — it won't be shown again.
        </p>
      </div>
      <div className="p-4 bg-slate-900 rounded-xl text-left">
        <p className="text-[10px] text-slate-400 mb-2 font-mono uppercase tracking-widest">
          API Key
        </p>
        <div className="flex items-start gap-2">
          <code className="flex-1 text-emerald-400 text-xs font-mono break-all leading-relaxed">
            {newAppApiKey}
          </code>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => newAppApiKey && copyApiKey(newAppApiKey)}
            className="shrink-0 text-slate-400 hover:text-emerald-400 hover:bg-white/10 h-8 w-8 p-0"
          >
            <Copy size={15} />
          </Button>
        </div>
      </div>
      <Button onClick={closeModal} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
        Done
      </Button>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Applications</h1>
          <p className="text-slate-500 mt-1">Manage your integrated applications and API keys.</p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 transition-all font-medium"
        >
          <Plus weight="bold" className="mr-2" />
          Create New App
        </Button>
      </div>

      {/* Stale Session Banner */}
      {isStaleSession && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <Warning size={20} className="text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">Session expired</p>
            <p className="text-sm text-red-600 mt-1">
              Your developer account was not found. This usually means the database was reset. Please log out and register again.
            </p>
          </div>
          <Button size="sm" variant="destructive" onClick={logout}>
            Log out
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Warning size={20} className="text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">{error}</p>
            <p className="text-sm text-amber-600 mt-1">
              Make sure the backend is running.
            </p>
          </div>
        </div>
      )}

      {/* Statistics */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <ChartBar size={20} className="text-slate-400" weight="duotone" />
          <h2 className="text-lg font-semibold text-slate-700">Statistics Overview</h2>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="relative w-full overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-dashed divide-slate-300">
            {/* Stat 1: Total Apps */}
            <div className="p-8 group relative overflow-hidden transition-colors hover:bg-slate-50/50 flex flex-col min-h-[180px] justify-between">
              {/* Giant Background Icon */}
              <div className="absolute -bottom-6 -right-6 opacity-[0.04] group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 ease-out z-0 pointer-events-none text-blue-900">
                <AppWindow size={160} weight="duotone" />
              </div>
              
              <div className="relative z-10 flex justify-end h-6">
                {/* No trend for total apps currently, just an empty space to match heights */}
              </div>

              <div className="relative z-10 mt-auto">
                <p className="text-[12px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Total Apps
                </p>
                <p className="text-4xl font-bold text-slate-900 tracking-tight">
                  {loading ? '-' : apps.length}
                </p>
              </div>
            </div>

            {/* Stat 2: Active Apps */}
            <div className="p-8 group relative overflow-hidden transition-colors hover:bg-slate-50/50 flex flex-col min-h-[180px] justify-between">
              <div className="absolute -bottom-6 -right-6 opacity-[0.04] group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 ease-out z-0 pointer-events-none text-emerald-900">
                <Activity size={160} weight="duotone" />
              </div>

              <div className="relative z-10 flex justify-end">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700">
                  12% <TrendUp size={12} weight="bold" />
                </div>
              </div>

              <div className="relative z-10 mt-auto">
                <p className="text-[12px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Active Apps
                </p>
                <p className="text-4xl font-bold text-slate-900 tracking-tight">
                  {loading ? '-' : activeApps}
                </p>
              </div>
            </div>

            {/* Stat 3: Total Events */}
            <div className="p-8 group relative overflow-hidden transition-colors hover:bg-slate-50/50 flex flex-col min-h-[180px] justify-between">
              <div className="absolute -bottom-6 -right-6 opacity-[0.04] group-hover:scale-110 group-hover:rotate-6 transition-transform duration-700 ease-out z-0 pointer-events-none text-purple-900">
                <Users size={160} weight="duotone" />
              </div>

              <div className="relative z-10 flex justify-end">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700">
                  24% <TrendUp size={12} weight="bold" />
                </div>
              </div>

              <div className="relative z-10 mt-auto">
                <p className="text-[12px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Total Events
                </p>
                <p className="text-4xl font-bold text-slate-900 tracking-tight">
                  {stats?.total_events?.toLocaleString() ?? '-'}
                </p>
              </div>
            </div>

            {/* Stat 4: Total Payouts */}
            <div className="p-8 group relative overflow-hidden transition-colors hover:bg-slate-50/50 flex flex-col min-h-[180px] justify-between">
              <div className="absolute -bottom-6 -right-6 opacity-[0.04] group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 ease-out z-0 pointer-events-none text-amber-900">
                <CurrencyDollar size={160} weight="duotone" />
              </div>

              <div className="relative z-10 flex justify-end">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700">
                  5% <TrendDown size={12} weight="bold" />
                </div>
              </div>

              <div className="relative z-10 mt-auto">
                <p className="text-[12px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                  Total Payouts
                </p>
                <p className="text-4xl font-bold text-slate-900 tracking-tight">
                  ${stats?.total_payouts?.toLocaleString() ?? '0'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Applications */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key size={20} className="text-slate-400" weight="duotone" />
            <h2 className="text-lg font-semibold text-slate-700">
              Your Applications (API Keys)
            </h2>
            <Badge variant="outline" className="ml-2 text-xs">
              {apps.length} apps
            </Badge>
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
                <div className="flex justify-center">
                  <PremiumAppCard
                    appName={app.name}
                    category={app.description || 'App Integration'}
                    badgeText={app.is_active ? 'Active' : 'Inactive'}
                    badgeActive={app.is_active}
                    icon={<Code size={20} weight="duotone" className="text-slate-700" />}
                    stat1Label="Events"
                    stat1Value={app.total_events.toLocaleString()}
                    stat2Label="Users"
                    stat2Value={app.total_users.toLocaleString()}
                    stat3Label="Revenue"
                    stat3Value={`$${app.total_revenue.toFixed(2)}`}
                    actionHref={`/dashboard/my-apps/${app.id}`}
                  />
                </div>
              </motion.div>
            ))}

            {/* Create New Card */}
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
                    <Plus
                      size={28}
                      className="text-slate-400 group-hover:text-blue-600 transition-colors"
                      weight="bold"
                    />
                  </div>
                  <h3 className="font-semibold text-slate-600 group-hover:text-blue-700 transition-colors mb-1">
                    Create New App
                  </h3>
                  <p className="text-sm text-slate-400 text-center">
                    Register a new application to get an API key
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </section>

      {/* Modal Portal — renders at document.body to escape any CSS stacking context */}
      {mounted &&
        showModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999]">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => !newAppApiKey && closeModal()}
            />

            {/* Modal */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full max-w-lg bg-white rounded-3xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-7">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Create Application</h2>
                    {!newAppApiKey && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Step {step} of {STEP_LABELS.length}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={closeModal}
                    className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    <X size={15} weight="bold" />
                  </button>
                </div>

                {/* Step indicator */}
                {!newAppApiKey && (
                  <div className="flex items-start px-8 pt-5">
                    {STEP_LABELS.map((label, i) => {
                      const stepNum = i + 1;
                      const isActive = step === stepNum;
                      const isDone = step > stepNum;
                      return (
                        <Fragment key={stepNum}>
                          <div className="flex flex-col items-center">
                            <div
                              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                                isDone
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : isActive
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'border-slate-200 text-slate-400 bg-white'
                              }`}
                            >
                              {isDone ? '✓' : stepNum}
                            </div>
                            <span
                              className={`text-[9px] mt-1.5 font-medium whitespace-nowrap transition-colors ${
                                isActive
                                  ? 'text-slate-900'
                                  : isDone
                                    ? 'text-emerald-600'
                                    : 'text-slate-400'
                              }`}
                            >
                              {label}
                            </span>
                          </div>
                          {i < STEP_LABELS.length - 1 && (
                            <div
                              className={`h-0.5 flex-1 mx-2 mt-3.5 transition-colors ${
                                isDone ? 'bg-emerald-400' : 'bg-slate-200'
                              }`}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                )}

                {/* Step content */}
                <div className="px-8 py-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={newAppApiKey ? 'success' : step}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.18 }}
                    >
                      {newAppApiKey ? renderSuccess() : renderStepContent()}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Navigation */}
                {!newAppApiKey && (
                  <div className="flex gap-3 px-8 pb-7">
                    {step > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep((s) => s - 1)}
                        className="flex-1"
                      >
                        ← Back
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeModal}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    )}

                    {step < STEP_LABELS.length ? (
                      <Button
                        type="button"
                        onClick={() => setStep((s) => s + 1)}
                        disabled={step === 1 && !form.name.trim()}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-40"
                      >
                        Next →
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleCreate}
                        disabled={creating}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
                      >
                        {creating ? (
                          <>
                            <CircleNotch size={15} className="mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Application'
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
