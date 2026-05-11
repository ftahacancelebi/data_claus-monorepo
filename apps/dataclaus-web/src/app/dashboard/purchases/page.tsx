'use client';

import Link from 'next/link';
import { useMyPurchases } from '@/lib/api-hooks';
import { RequireAuth } from '@/lib/route-guards';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ErrorPanel } from '@/components/layout/error-panel';

function PurchasesContent() {
  const { data, isLoading, isError, error, refetch } = useMyPurchases();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 bg-slate-100 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorPanel error={error} reset={() => void refetch()} />;
  }

  const purchases = data ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Your Purchases
        </h1>
        <p className="text-slate-500 mt-1">
          Datasets you&apos;ve bought from the marketplace.
        </p>
      </div>

      {purchases.length === 0 ? (
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">You haven&apos;t purchased any packages yet.</p>
            <Link
              href="/dashboard/marketplace"
              className="inline-block mt-4 text-primary font-medium hover:underline"
            >
              Browse the marketplace →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {purchases.map((p) => (
            <Card key={p.id} className="glass-panel border-0 shadow-md">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 truncate">
                    {p.package?.title ?? 'Package'}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {p.package?.category ?? '—'} ·{' '}
                    <span className="font-mono">
                      {new Date(p.purchasedAt).toLocaleString()}
                    </span>
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  ${p.amount.toFixed(2)}
                </Badge>
                {p.package && (
                  <Link
                    href={`/dashboard/marketplace/${p.package.id}`}
                    className="text-sm text-primary hover:underline whitespace-nowrap"
                  >
                    View details →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <RequireAuth>
      <PurchasesContent />
    </RequireAuth>
  );
}
