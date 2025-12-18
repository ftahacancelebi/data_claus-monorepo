'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth, DEMO_ACCOUNTS } from '@/lib/auth-context';
import type { UserRole } from '@/lib/types';
import { REVENUE_SHARES } from '@/lib/types';
import { User, Code, ShoppingCart, Shield } from 'lucide-react';

const roles: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'user',
    label: 'End User',
    description: `Earn ${REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-${REVENUE_SHARES.MAX_USER_SHARE_PERCENT}% of ad revenue from your data`,
  },
  {
    value: 'developer',
    label: 'Developer',
    description: `Configure user share, earn the remainder (5-45%)`,
  },
  {
    value: 'buyer',
    label: 'Buyer',
    description: 'Run campaigns and access quality data',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full system access and management',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { login, register, loginAsDemo, user, isLoading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  if (!isLoading && user) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isRegister) {
        await register(name, email, password, selectedRole);
        toast({ title: 'Account created successfully' });
      } else {
        await login(email, password, selectedRole);
      }
      router.push('/dashboard');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Authentication failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">🎅 DataClaus</h1>
          <p className="text-muted-foreground">
            Data marketplace & advertising platform
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Fair revenue sharing: {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
            {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}% to users,{' '}
            {REVENUE_SHARES.PLATFORM_FEE_PERCENT}% platform fee
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{isRegister ? 'Create Account' : 'Sign In'}</CardTitle>
              <CardDescription>
                {isRegister
                  ? 'Register a new account'
                  : 'Enter your credentials'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name or company"
                      required={isRegister}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {roles.map((role) => (
                      <Button
                        key={role.value}
                        type="button"
                        variant={
                          selectedRole === role.value ? 'default' : 'outline'
                        }
                        size="sm"
                        onClick={() => setSelectedRole(role.value)}
                      >
                        {role.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting
                    ? 'Please wait...'
                    : isRegister
                    ? 'Create Account'
                    : 'Sign In'}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => setIsRegister(!isRegister)}
                >
                  {isRegister
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Register"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🚀 Quick Demo Access</CardTitle>
              <CardDescription>
                Click to instantly login as a demo account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => {
                  loginAsDemo('user');
                  router.push('/dashboard');
                }}
              >
                <User className="h-5 w-5 mr-3 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">Demo User</div>
                  <div className="text-xs text-muted-foreground">
                    Earn from your data usage
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => {
                  loginAsDemo('developer');
                  router.push('/dashboard');
                }}
              >
                <Code className="h-5 w-5 mr-3 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">Demo Developer</div>
                  <div className="text-xs text-muted-foreground">
                    Build apps, configure revenue share
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => {
                  loginAsDemo('buyer');
                  router.push('/dashboard');
                }}
              >
                <ShoppingCart className="h-5 w-5 mr-3 text-purple-600" />
                <div className="text-left">
                  <div className="font-medium">Demo Buyer</div>
                  <div className="text-xs text-muted-foreground">
                    Run campaigns, access data
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => {
                  loginAsDemo('admin');
                  router.push('/dashboard');
                }}
              >
                <Shield className="h-5 w-5 mr-3 text-red-600" />
                <div className="text-left">
                  <div className="font-medium">Demo Admin</div>
                  <div className="text-xs text-muted-foreground">
                    Full platform management
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Revenue Sharing Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-700">
                  {REVENUE_SHARES.MIN_USER_SHARE_PERCENT}-
                  {REVENUE_SHARES.MAX_USER_SHARE_PERCENT}%
                </p>
                <p className="text-sm text-green-600">To Users</p>
                <p className="text-xs text-muted-foreground">
                  Set by developer
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-blue-700">5-45%</p>
                <p className="text-sm text-blue-600">To Developers</p>
                <p className="text-xs text-muted-foreground">
                  Remainder after fees
                </p>
              </div>
              <div className="p-4 bg-gray-100 rounded-lg text-center">
                <p className="text-3xl font-bold text-gray-700">
                  {REVENUE_SHARES.PLATFORM_FEE_PERCENT}%
                </p>
                <p className="text-sm text-gray-600">Platform (fixed)</p>
                <p className="text-xs text-muted-foreground">Infrastructure</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
