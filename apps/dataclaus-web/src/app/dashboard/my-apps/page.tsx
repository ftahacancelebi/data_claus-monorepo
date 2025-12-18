'use client';

import { useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/auth-context';
import { Plus, Code, Users, DollarSign, Edit, Trash2 } from 'lucide-react';

import { REVENUE_SHARES } from '@/lib/types';
import { Slider } from '@/components/ui/slider';

interface App {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  userSharePercent: number; // Revenue share for users (50-90%)
  users: number;
  revenue: number;
  status: 'active' | 'paused' | 'pending';
}

const MOCK_APPS: App[] = [
  {
    id: '1',
    name: 'FitTracker SDK',
    description: 'Fitness tracking integration',
    url: 'https://fittracker.io',
    category: 'Health',
    userSharePercent: 75, // Generous to attract users
    users: 1250,
    revenue: 450,
    status: 'active',
  },
  {
    id: '2',
    name: 'Survey Widget',
    description: 'Embeddable survey component',
    url: 'https://surveys.io',
    category: 'Research',
    userSharePercent: 70, // Default
    users: 890,
    revenue: 320,
    status: 'active',
  },
  {
    id: '3',
    name: 'Location API',
    description: 'Anonymous location data API',
    url: 'https://locapi.io',
    category: 'Travel',
    userSharePercent: 85, // Very generous
    users: 450,
    revenue: 180,
    status: 'paused',
  },
];

export default function MyAppsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apps, setApps] = useState<App[]>(MOCK_APPS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    url: '',
    category: 'Health',
    userSharePercent: REVENUE_SHARES.DEFAULT_USER_SHARE_PERCENT,
  });
  const [editingApp, setEditingApp] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newApp: App = {
      id: Date.now().toString(),
      name: form.name,
      description: form.description,
      url: form.url,
      category: form.category,
      userSharePercent: form.userSharePercent,
      users: 0,
      revenue: 0,
      status: 'pending',
    };
    setApps([...apps, newApp]);
    setForm({
      name: '',
      description: '',
      url: '',
      category: 'Health',
      userSharePercent: REVENUE_SHARES.DEFAULT_USER_SHARE_PERCENT,
    });
    setShowForm(false);
    toast({
      title: 'App submitted',
      description: 'Your app is pending review',
    });
  };

  const updateAppUserShare = (appId: string, newShare: number) => {
    setApps(
      apps.map((app) =>
        app.id === appId ? { ...app, userSharePercent: newShare } : app
      )
    );
  };

  const toggleStatus = (id: string) => {
    setApps(
      apps.map((app) => {
        if (app.id === id) {
          return {
            ...app,
            status: app.status === 'active' ? 'paused' : 'active',
          };
        }
        return app;
      })
    );
  };

  const totalUsers = apps.reduce((sum, app) => sum + app.users, 0);
  const totalRevenue = apps.reduce((sum, app) => sum + app.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Apps</h1>
          <p className="text-muted-foreground">
            Manage your published applications
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          New App
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Apps</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{apps.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalUsers.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Publish New App</CardTitle>
            <CardDescription>Submit your app for review</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>App Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                >
                  <option>Health</option>
                  <option>Research</option>
                  <option>Finance</option>
                  <option>Travel</option>
                  <option>Shopping</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>User Share: {form.userSharePercent}%</Label>
                <Slider
                  value={[form.userSharePercent]}
                  onValueChange={(v) =>
                    setForm({ ...form, userSharePercent: v[0] })
                  }
                  min={REVENUE_SHARES.MIN_USER_SHARE_PERCENT}
                  max={REVENUE_SHARES.MAX_USER_SHARE_PERCENT}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  You get{' '}
                  {100 -
                    REVENUE_SHARES.PLATFORM_FEE_PERCENT -
                    form.userSharePercent}
                  % (Platform: {REVENUE_SHARES.PLATFORM_FEE_PERCENT}%)
                </p>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit">Submit App</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Apps</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>User Share</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{app.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {app.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{app.category}</TableCell>
                  <TableCell>
                    {editingApp === app.id ? (
                      <div className="w-32">
                        <Slider
                          value={[app.userSharePercent]}
                          onValueChange={(v) =>
                            updateAppUserShare(app.id, v[0])
                          }
                          min={REVENUE_SHARES.MIN_USER_SHARE_PERCENT}
                          max={REVENUE_SHARES.MAX_USER_SHARE_PERCENT}
                          step={1}
                        />
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-green-600">
                            {app.userSharePercent}% users
                          </span>
                          <span className="text-blue-600">
                            {100 -
                              REVENUE_SHARES.PLATFORM_FEE_PERCENT -
                              app.userSharePercent}
                            % you
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Badge variant="default" className="bg-green-600">
                          {app.userSharePercent}%
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          You:{' '}
                          {100 -
                            REVENUE_SHARES.PLATFORM_FEE_PERCENT -
                            app.userSharePercent}
                          %
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{app.users.toLocaleString()}</TableCell>
                  <TableCell>${app.revenue.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        app.status === 'active'
                          ? 'success'
                          : app.status === 'pending'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditingApp(editingApp === app.id ? null : app.id)
                        }
                      >
                        {editingApp === app.id ? 'Done' : 'Edit Share'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleStatus(app.id)}
                      >
                        {app.status === 'active' ? 'Pause' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
