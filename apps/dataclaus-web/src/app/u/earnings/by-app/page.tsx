'use client';

import { AppEarningsCard } from '@/components/user/AppEarningsCard';
import { Card, CardContent } from '@/components/ui/card';
import { AppWindow } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { useEarningsByApp } from '@/lib/api-hooks';

export default function EarningsByAppPage() {
  const appsQuery = useEarningsByApp();
  const apps = appsQuery.data ?? [];
  const loading = appsQuery.isLoading;
  const error = appsQuery.error?.message ?? null;

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Uygulama bazında</h1>
        <p className="text-sm text-slate-500">
          Hangi uygulamadan ne kadar kazandığını gör. Tıkla, detay aç.
        </p>
      </header>

      {error && !loading ? (
        <Card className="border-rose-100 bg-rose-50">
          <CardContent className="p-4 text-sm text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => appsQuery.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="border-slate-100 animate-pulse h-20" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <Card className="border-dashed border-slate-200">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-blue-50 text-primary flex items-center justify-center">
              <AppWindow size={24} weight="duotone" />
            </div>
            <h3 className="font-semibold text-slate-900">
              Bağlı uygulama yok
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              DataClaus SDK kullanan bir uygulamada login olduğunda burada
              listelenir.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {apps.map((app) => (
            <AppEarningsCard key={app.applicationId} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
