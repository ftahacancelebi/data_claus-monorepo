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
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { ExternalLink, Search, Star, DollarSign } from 'lucide-react';

import { REVENUE_SHARES } from '@/lib/types';

// Mock data for apps with user share percentage
const MOCK_APPS = [
  {
    id: '1',
    name: 'FitTracker Pro',
    category: 'Health',
    description: 'Track your fitness and earn rewards',
    reward: '$0.05/day',
    userSharePercent: 85, // Very generous!
    rating: 4.8,
    users: 12500,
  },
  {
    id: '2',
    name: 'SmartSurvey',
    category: 'Research',
    description: 'Complete surveys and get paid',
    reward: '$0.10/survey',
    userSharePercent: 75,
    rating: 4.5,
    users: 8900,
  },
  {
    id: '3',
    name: 'DataWallet',
    category: 'Finance',
    description: 'Manage your data earnings',
    reward: '$0.02/tx',
    userSharePercent: 70, // Default
    rating: 4.7,
    users: 15000,
  },
  {
    id: '4',
    name: 'LocationShare',
    category: 'Travel',
    description: 'Share location data anonymously',
    reward: '$0.03/day',
    userSharePercent: 80,
    rating: 4.2,
    users: 6700,
  },
  {
    id: '5',
    name: 'ShopTracker',
    category: 'Shopping',
    description: 'Earn from your shopping habits',
    reward: '$0.08/purchase',
    userSharePercent: 65,
    rating: 4.4,
    users: 9200,
  },
  {
    id: '6',
    name: 'HealthMetrics',
    category: 'Health',
    description: 'Share health data for research',
    reward: '$0.15/day',
    userSharePercent: 90, // Maximum generosity!
    rating: 4.9,
    users: 5400,
  },
];

const CATEGORIES = [
  'All',
  'Health',
  'Research',
  'Finance',
  'Travel',
  'Shopping',
];

export default function AppsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [connectedApps, setConnectedApps] = useState<string[]>([]);

  if (!user) return null;

  const filteredApps = MOCK_APPS.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || app.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleConnect = (appId: string) => {
    if (connectedApps.includes(appId)) {
      setConnectedApps(connectedApps.filter((id) => id !== appId));
    } else {
      setConnectedApps([...connectedApps, appId]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Apps</h1>
        <p className="text-muted-foreground">
          Connect apps to earn rewards from your data
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredApps.map((app) => {
          const isConnected = connectedApps.includes(app.id);
          return (
            <Card key={app.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{app.name}</CardTitle>
                    <CardDescription>{app.category}</CardDescription>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="default"
                      className={`${
                        app.userSharePercent >= 80
                          ? 'bg-green-600'
                          : app.userSharePercent >= 70
                          ? 'bg-blue-600'
                          : 'bg-gray-600'
                      }`}
                    >
                      {app.userSharePercent}% to you
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {app.reward}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {app.description}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{app.rating}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {app.users.toLocaleString()} users
                  </span>
                </div>
                {app.userSharePercent >= 80 && (
                  <p className="text-xs text-green-600 font-medium">
                    🌟 High user share - great for earnings!
                  </p>
                )}
                <Button
                  className="w-full"
                  variant={isConnected ? 'outline' : 'default'}
                  onClick={() => handleConnect(app.id)}
                >
                  {isConnected ? (
                    'Disconnect'
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {connectedApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Connected Apps ({connectedApps.length})
            </CardTitle>
            <CardDescription>
              You&apos;re earning from these apps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {connectedApps.map((appId) => {
                const app = MOCK_APPS.find((a) => a.id === appId);
                return app ? (
                  <Badge
                    key={appId}
                    variant="success"
                    className="text-sm py-1 px-3"
                  >
                    {app.name} - {app.reward}
                  </Badge>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
