'use client';

import Link from 'next/link';
import { useMyPackages } from '@/lib/api-hooks';
import { RequireRole } from '@/lib/route-guards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataclausScoreGauge } from '@/components/packages/score-gauge';
import { ErrorPanel } from '@/components/layout/error-panel';
import type { DataPackage } from '@/lib/api';

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

function PackagesContent() {
  const { data, isLoading, isError, error, refetch } = useMyPackages();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-slate-100 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorPanel error={error} reset={() => void refetch()} />;
  }

  const packages = data ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Data Packages
          </h1>
          <p className="text-slate-500 mt-1">
            Submit datasets for AI evaluation and listing on the marketplace.
          </p>
        </div>
        <Link href="/dashboard/packages/new">
          <Button>New Package</Button>
        </Link>
      </div>

      {packages.length === 0 ? (
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">
              You haven&apos;t submitted any packages yet.
            </p>
            <Link href="/dashboard/packages/new" className="inline-block mt-4">
              <Button>Submit your first package</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/dashboard/packages/${pkg.id}`}
              className="block"
            >
              <Card className="glass-panel border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center gap-6">
                    <DataclausScoreGauge value={pkg.dataclausScore} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-slate-900 truncate">
                          {pkg.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className={statusVariant(pkg.status)}
                        >
                          {pkg.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500 truncate">
                        {pkg.category} · {pkg.claimedMetrics.row_count.toLocaleString()} rows ·{' '}
                        {pkg.claimedMetrics.unique_users.toLocaleString()} users
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">
                        ${pkg.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-400">
                        submitted {new Date(pkg.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PackagesPage() {
  return (
    <RequireRole role={['developer', 'admin']}>
      <PackagesContent />
    </RequireRole>
  );
}
