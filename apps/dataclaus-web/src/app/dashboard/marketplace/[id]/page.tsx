'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  usePackage,
  usePurchasePackage,
  useMyPurchases,
} from '@/lib/api-hooks';
import { RequireAuth } from '@/lib/route-guards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { DataclausScoreGauge } from '@/components/packages/score-gauge';
import { ErrorPanel } from '@/components/layout/error-panel';
import { ApiError } from '@/lib/api';
import { DimensionGrid } from '@/components/marketplace/DimensionGrid';
import type { DimensionsMapValued } from '@/lib/schemas';

function DimensionTotalStrip({ dimensions }: { dimensions: DimensionsMapValued }) {
  const entries = Object.values(dimensions).filter(
    (d): d is NonNullable<typeof d> => !!d,
  );
  const total = entries.reduce((s, d) => s + d.total_usd, 0);
  const deviceOnly = dimensions.device?.total_usd ?? 0;
  const multiDim = entries.length > 1;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-4">
      <div className="space-y-1">
        <div className="text-[10px] tracking-[0.18em] text-slate-500 font-semibold">
          PACKAGE TOTAL
        </div>
        <div className="font-mono text-3xl tabular-nums text-slate-900">
          ${total.toFixed(2)}
        </div>
      </div>
      {multiDim && deviceOnly > 0 && (
        <div className="text-right space-y-1">
          <div className="text-[10px] text-slate-500">
            Device-only would be
          </div>
          <div className="font-mono text-sm text-slate-700">
            ${deviceOnly.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400">
            {(total / deviceOnly).toFixed(1)}× richer
          </div>
        </div>
      )}
    </div>
  );
}

function MarketplaceDetailContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: pkg, isLoading, isError, error, refetch } = usePackage(id);
  const { data: myPurchases } = useMyPurchases();
  const purchase = usePurchasePackage();
  const [confirming, setConfirming] = useState(false);

  if (isLoading || !pkg) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="h-8 w-1/3 bg-slate-100 rounded animate-pulse" />
        <div className="h-64 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }
  if (isError) {
    return <ErrorPanel error={error} reset={() => void refetch()} />;
  }

  const isPurchasable =
    pkg.status === 'certified' || pkg.status === 'sold';
  const isOwner = user?.id === pkg.developerId;
  // Server-truth (cache). `usePurchasePackage` invalidates `purchases.all`, so
  // after a successful buy this refetches and `alreadyBought` flips → button
  // disables in the same render. Stops the double-charge the jury would hit by
  // clicking again or returning via Purchases → "View details".
  const alreadyBought =
    myPurchases?.some((p) => p.packageId === id) ?? false;
  const canBuy = isPurchasable && !isOwner && !alreadyBought;

  async function handleBuy() {
    try {
      await purchase.mutateAsync(id);
      toast({
        title: 'Purchase complete',
        description: 'Funds settled. Check your purchases.',
      });
      router.push('/dashboard/purchases');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Purchase failed';
      toast({ title: 'Purchase failed', description: message });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/dashboard/marketplace"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to marketplace
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {pkg.title}
          </h1>
          <Badge variant="outline" className="capitalize">
            {pkg.category}
          </Badge>
        </div>
        {pkg.description && (
          <p className="text-slate-500 mt-2">{pkg.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-panel border-0 shadow-lg md:col-span-1">
          <CardContent className="p-6 flex flex-col items-center">
            <DataclausScoreGauge
              value={pkg.dataclausScore}
              size="lg"
              label="DataClaus Trust Score"
            />
            <div className="mt-6 w-full">
              <p className="text-3xl font-bold text-slate-900 text-center">
                ${pkg.price.toFixed(2)}
              </p>
              <p className="text-xs text-slate-500 text-center">
                {pkg.claimedMetrics.row_count.toLocaleString()} rows
              </p>
              <Button
                className="w-full mt-4"
                disabled={!canBuy || purchase.isPending || confirming}
                onClick={() => {
                  if (!confirming) {
                    setConfirming(true);
                    return;
                  }
                  void handleBuy();
                }}
              >
                {purchase.isPending
                  ? 'Settling…'
                  : isOwner
                  ? 'You own this package'
                  : alreadyBought
                  ? 'Already purchased'
                  : !isPurchasable
                  ? `Not available (${pkg.status})`
                  : confirming
                  ? `Confirm purchase for $${pkg.price.toFixed(2)}`
                  : 'Purchase'}
              </Button>
              {alreadyBought && (
                <Link
                  href="/dashboard/purchases"
                  className="block w-full mt-2 text-center text-xs text-slate-500 hover:text-slate-900"
                >
                  View in Purchases →
                </Link>
              )}
              {confirming && canBuy && !purchase.isPending && (
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="w-full mt-2 text-xs text-slate-500 hover:text-slate-900"
                >
                  Cancel
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-0 shadow-lg md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">AI Audit</CardTitle>
          </CardHeader>
          <CardContent>
            {pkg.llmEvaluation ? (
              <>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {pkg.llmEvaluation.summary}
                </p>
                {pkg.llmEvaluation.red_flags.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">
                      Caveats
                    </p>
                    <ul className="space-y-1">
                      {pkg.llmEvaluation.red_flags.map((flag, i) => (
                        <li key={i} className="text-sm text-slate-700">
                          • {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {pkg.llmEvaluation.buyer_match.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Recommended For
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {pkg.llmEvaluation.buyer_match.map((b, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-slate-100">
                  {Object.entries(pkg.llmEvaluation.rubric).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                        {k.replace(/_/g, ' ')}
                      </p>
                      <p className="text-lg font-bold text-slate-900">
                        {v.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Evaluation pending — check back shortly.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {pkg.dimensions && Object.keys(pkg.dimensions).length > 0 && (
        <Card className="glass-panel border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">
              <span className="text-xs tracking-[0.18em] text-slate-500 font-semibold">
                DIMENSION BREAKDOWN
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DimensionGrid dimensions={pkg.dimensions} />
            <DimensionTotalStrip dimensions={pkg.dimensions} />
          </CardContent>
        </Card>
      )}

      <Card className="glass-panel border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base">What you get</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Schema
              </p>
              <pre className="bg-slate-50 rounded p-3 text-xs font-mono overflow-x-auto max-h-64">
                {JSON.stringify(pkg.schemaJson, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Sample Rows (preview)
              </p>
              <pre className="bg-slate-50 rounded p-3 text-xs font-mono overflow-x-auto max-h-64">
                {JSON.stringify(pkg.sampleRows.slice(0, 2), null, 2)}
              </pre>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Full sample download unlocks immediately after purchase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MarketplaceDetailPage() {
  return (
    <RequireAuth>
      <MarketplaceDetailContent />
    </RequireAuth>
  );
}
