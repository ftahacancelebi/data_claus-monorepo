'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useAdminAllPackages,
  useDelistPackage,
  useReevaluatePackage,
} from '@/lib/api-hooks';
import { RequireRole } from '@/lib/route-guards';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { DataclausScoreGauge } from '@/components/packages/score-gauge';
import { ErrorPanel } from '@/components/layout/error-panel';
import type { DataPackage } from '@/lib/api';

const STATUS_OPTIONS: (DataPackage['status'] | 'all')[] = [
  'all',
  'pending',
  'evaluating',
  'certified',
  'sold',
  'rejected',
  'delisted',
];

function statusVariant(status: DataPackage['status']) {
  switch (status) {
    case 'certified':
    case 'sold':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'evaluating':
    case 'pending':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'rejected':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'delisted':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function AdminPackagesContent() {
  const { toast } = useToast();
  const { data, isLoading, isError, error, refetch } = useAdminAllPackages();
  const reevaluate = useReevaluatePackage();
  const delist = useDelistPackage();
  const [filter, setFilter] = useState<(typeof STATUS_OPTIONS)[number]>('all');

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }
  if (isError) {
    return <ErrorPanel error={error} reset={() => void refetch()} />;
  }

  const all = data ?? [];
  const packages = filter === 'all' ? all : all.filter((p) => p.status === filter);

  async function handleReevaluate(id: string) {
    try {
      await reevaluate.mutateAsync(id);
      toast({ title: 'Re-evaluation queued' });
    } catch (err) {
      toast({ title: 'Failed', description: (err as Error).message });
    }
  }

  async function handleDelist(id: string) {
    if (!confirm('Delist this package?')) return;
    try {
      await delist.mutateAsync(id);
      toast({ title: 'Package delisted' });
    } catch (err) {
      toast({ title: 'Failed', description: (err as Error).message });
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Package Moderation
        </h1>
        <p className="text-slate-500 mt-1">
          All submitted packages across the platform.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === s
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s}
            {s !== 'all' && (
              <span className="ml-1 text-[10px] opacity-75">
                {all.filter((p) => p.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {packages.length === 0 ? (
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">No packages in this state.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="glass-panel border-0 shadow-md">
              <CardContent className="p-5 flex items-center gap-4">
                <DataclausScoreGauge value={pkg.dataclausScore} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-slate-900 truncate">
                      {pkg.title}
                    </h3>
                    <Badge variant="outline" className={statusVariant(pkg.status)}>
                      {pkg.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    {pkg.category} · ${pkg.price.toFixed(2)} · dev{' '}
                    <span className="font-mono">
                      {pkg.developerId.slice(0, 8)}
                    </span>
                  </p>
                  {pkg.llmEvaluation?.red_flags &&
                    pkg.llmEvaluation.red_flags.length > 0 && (
                      <p className="text-xs text-red-600 mt-1 truncate">
                        ⚠ {pkg.llmEvaluation.red_flags[0]}
                      </p>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/dashboard/marketplace/${pkg.id}`}
                    className="text-xs text-primary hover:underline whitespace-nowrap text-right"
                  >
                    View →
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReevaluate(pkg.id)}
                    disabled={reevaluate.isPending}
                  >
                    Re-evaluate
                  </Button>
                  {pkg.status !== 'delisted' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelist(pkg.id)}
                      disabled={delist.isPending}
                    >
                      Delist
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPackagesPage() {
  return (
    <RequireRole role="admin">
      <AdminPackagesContent />
    </RequireRole>
  );
}
