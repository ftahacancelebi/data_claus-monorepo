'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Logo from '../assets/logos/logo.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';
import { 
  EnvelopeSimple, 
  LockKey, 
  CircleNotch, 
  ArrowRight, 
  User, 
  GlobeHemisphereWest, 
  ShieldCheck,
  TrendUp,
  Cpu,
  CheckCircle,
  Fingerprint
} from 'phosphor-react';


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { login, register, user, isLoading } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  if (!isLoading && user) {
    router.push(user.role === 'user' ? '/u/dashboard' : '/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let resolvedRole: UserRole | undefined;
      if (isRegister) {
        await register(name, email, password, selectedRole);
        resolvedRole = selectedRole;
        toast({ title: 'Account created successfully' });
      } else {
        await login(email, password);
        resolvedRole =
          (typeof window !== 'undefined'
            ? (JSON.parse(
                window.localStorage.getItem('dataclaus_user') ?? 'null',
              )?.role as UserRole | undefined)
            : undefined) ?? undefined;
      }
      router.push(resolvedRole === 'user' ? '/u/dashboard' : '/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <CircleNotch size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-slate-900">
      
      {/* Animated Background Mesh */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-900/30 rounded-full blur-[150px] animate-float"></div>
          <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-float-delayed"></div>
          
          {/* Subtle Grid Overlay */}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.08]"></div>
       </div>

       {/* Main Content Container */}
       <div className="relative z-10 w-full max-w-[1400px] mx-auto min-h-screen flex flex-col lg:flex-row items-center justify-center p-6 gap-12 lg:gap-24">
          
          {/* Left Side: Brand Narrative */}
          <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left pt-10 lg:pt-0">
              
              {/* Logo/Badge */}
              <div className="animate-float mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium text-slate-300">
                 <ShieldCheck size={18} className="text-blue-400" weight="duotone" />
                 <span>Enterprise Grade Security</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-6">
                 Data Infrastructure for the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">Intelligence Age</span>.
              </h1>
              
              <p className="text-xl text-slate-400 max-w-lg font-light leading-relaxed mb-10">
                 DataClaus provides the compliant, high-performance rails for monetizing and acquiring structured training data.
              </p>

              {/* Stats / Trust Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-8 opacity-80">
                 <div className="flex items-center gap-2 text-slate-400">
                     <GlobeHemisphereWest size={24} weight="duotone" />
                     <span className="font-medium">Global CDN</span>
                 </div>
                  <div className="flex items-center gap-2 text-slate-400">
                     <Fingerprint size={24} weight="duotone" />
                     <span className="font-medium">Biometric Auth</span>
                 </div>
                  <div className="flex items-center gap-2 text-slate-400">
                     <Cpu size={24} weight="duotone" />
                     <span className="font-medium">99.9% Uptime</span>
                 </div>
              </div>

          </div>

          {/* Right Side: The Access Terminal (Login Form) */}
          <div className="w-full lg:w-[420px] animate-float-delayed" style={{ animationDuration: '8s' }}>
             <div className="gradient-border-card rounded-3xl p-8 lg:p-10 shadow-2xl shadow-blue-900/30 relative bg-white">
                
                {/* Logo in form header */}
                <div className="flex items-center justify-center mb-6">
                  <Image src={Logo} alt="DataClaus" width={120} height={40} className="h-8 w-auto" />
                </div>

                <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                        {isRegister ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-2">
                        {isRegister ? 'Set up your developer credentials.' : 'Sign in to your account.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name Field (Register only) */}
                    {isRegister && (
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name</Label>
                        <div className="relative group">
                            <Input 
                                value={name} onChange={e => setName(e.target.value)} required 
                                className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20 transition-all text-slate-800 placeholder:text-slate-300"
                                placeholder="John Smith"
                            />
                            <User size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" weight="duotone" />
                        </div>
                    </div>
                    )}

                    {/* Email Field */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</Label>
                        <div className="relative group">
                            <Input 
                                type="email" value={email} onChange={e => setEmail(e.target.value)} required 
                                className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20 transition-all text-slate-800 placeholder:text-slate-300"
                                placeholder="you@company.com"
                            />
                            <EnvelopeSimple size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" weight="duotone" />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                         <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</Label>
                         <div className="relative group">
                            <Input 
                                type="password" value={password} onChange={e => setPassword(e.target.value)} required 
                                className="pl-10 h-11 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500/20 transition-all text-slate-800 placeholder:text-slate-300"
                                placeholder="••••••••"
                            />
                            <LockKey size={18} className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" weight="duotone" />
                        </div>
                    </div>
                    
                    {/* Role Selection (Register only) */}
                    {isRegister && (
                         <div className="grid grid-cols-3 gap-2 pt-2">
                             <button type="button" onClick={() => setSelectedRole('developer')}
                                className={`p-3 rounded-xl border text-left transition-all ${selectedRole === 'developer' ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'}`}
                             >
                                <div className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                                    <Cpu size={14} weight="duotone" className="text-primary"/> Developer
                                </div>
                                <div className="text-[10px] text-slate-500 leading-tight">SDK & Earn</div>
                             </button>
                             <button type="button" onClick={() => setSelectedRole('user')}
                                className={`p-3 rounded-xl border text-left transition-all ${selectedRole === 'user' ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'}`}
                             >
                                <div className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                                    <User size={14} weight="duotone" className="text-primary"/> User
                                </div>
                                <div className="text-[10px] text-slate-500 leading-tight">Earn Revenue</div>
                             </button>
                             <button type="button" onClick={() => setSelectedRole('buyer')}
                                className={`p-3 rounded-xl border text-left transition-all ${selectedRole === 'buyer' ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'}`}
                             >
                                <div className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                                    <TrendUp size={14} weight="duotone" className="text-primary"/> Buyer
                                </div>
                                <div className="text-[10px] text-slate-500 leading-tight">Access Data</div>
                             </button>
                         </div>
                    )}

                    <Button className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl shadow-lg shadow-slate-900/10 transition-all active:scale-[0.98] mt-2">
                        {submitting ? <CircleNotch className="animate-spin" /> : (
                            <span className="flex items-center gap-2">
                                {isRegister ? 'Create Account' : 'Sign In'} <ArrowRight weight="bold"/>
                            </span>
                        )}
                    </Button>
                </form>

                <div className="mt-6 text-center border-t border-slate-100 pt-6">
                    <p className="text-sm text-slate-500">
                        {isRegister ? 'Already have an account?' : 'New to DataClaus?'} 
                        <button onClick={() => setIsRegister(!isRegister)} className="ml-1.5 font-semibold text-primary hover:text-blue-700 transition-colors">
                            {isRegister ? 'Sign in' : 'Create account'}
                        </button>
                    </p>
                </div>

             </div>
         </div>
      </div>

    </div>
  );
}
