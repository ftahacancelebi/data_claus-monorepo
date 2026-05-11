'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePackages } from '@/lib/api-hooks';
import { RequireAuth } from '@/lib/route-guards';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataclausScoreGauge } from '@/components/packages/score-gauge';
import { ErrorPanel } from '@/components/layout/error-panel';

const CATEGORY_OPTIONS = [
  'all',
  'fitness',
  'social',
  'finance',
  'entertainment',
  'location',
  'health',
  'productivity',
  'other',
];

function MarketplaceContent() {
  const [category, setCategory] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  const filters = useMemo(() => {
    const f: Record<string, unknown> = {};
    if (category !== 'all') f.category = category;
    if (minScore > 0) f.min_score = minScore;
    if (typeof maxPrice === 'number' && maxPrice > 0) f.max_price = maxPrice;
    return f;
  }, [category, minScore, maxPrice]);

  const { data, isLoading, isError, error, refetch } = usePackages(filters);

  if (isError) {
    return <ErrorPanel error={error} reset={() => void refetch()} />;
  }

  const packages = data?.data ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Data Marketplace
          </h1>
          <p className="text-slate-500 mt-1">
            AI-audited behavioral datasets, scored and ready to buy.
          </p>
        </div>
      </div>

      <Card className="glass-panel border-0 shadow-md">
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[160px]">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label htmlFor="min_score">Min Trust Score</Label>
            <Input
              id="min_score"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label htmlFor="max_price">Max Price (USD)</Label>
            <Input
              id="max_price"
              type="number"
              step="1"
              min="0"
              value={maxPrice}
              onChange={(e) =>
                setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="any"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-48 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {!isLoading && packages.length === 0 && (
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">
              No packages match these filters. Try widening the score or category.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && packages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((pkg) => (
            <Link
              key={pkg.id}
              href={`/dashboard/marketplace/${pkg.id}`}
              className="block"
            >
              <Card className="glass-panel border-0 shadow-md hover:shadow-lg transition-shadow h-full">
                <CardContent className="p-5 flex gap-4">
                  <DataclausScoreGauge value={pkg.dataclausScore} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs capitalize">
                        {pkg.category}
                      </Badge>
                      {pkg.status === 'sold' && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                        >
                          popular
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 line-clamp-2">
                      {pkg.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {pkg.llmEvaluation?.summary ?? pkg.description ?? ''}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-slate-500">
                        {pkg.claimedMetrics.row_count.toLocaleString()} rows ·{' '}
                        {pkg.claimedMetrics.unique_users.toLocaleString()} users
                      </p>
                      <p className="text-xl font-bold text-slate-900">
                        ${pkg.price.toFixed(2)}
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

export default function MarketplacePage() {
  return (
    <RequireAuth>
      <MarketplaceContent />
    </RequireAuth>
  );
}
