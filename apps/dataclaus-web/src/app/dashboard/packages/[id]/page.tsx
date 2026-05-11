'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePackage } from '@/lib/api-hooks';
import { RequireAuth } from '@/lib/route-guards';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

function PackageDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading, isError, error, refetch } = usePackage(id);

  if (isLoading || !data) {
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
  const pkg = data;

  const evaluating = pkg.status === 'evaluating' || pkg.status === 'pending';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/dashboard/packages"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to packages
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {pkg.title}
          </h1>
          <Badge variant="outline" className={statusVariant(pkg.status)}>
            {pkg.status}
          </Badge>
        </div>
        <p className="text-slate-500 mt-1">
          {pkg.category} · ${pkg.price.toFixed(2)} ·{' '}
          {pkg.claimedMetrics.row_count.toLocaleString()} rows
        </p>
      </div>

      {evaluating && (
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="inline-flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-base font-medium text-slate-700">
                DataClaus AI is evaluating your package…
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Typical evaluation takes 3–8 seconds. This page refreshes automatically.
            </p>
          </CardContent>
        </Card>
      )}

      {!evaluating && pkg.llmEvaluation && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass-panel border-0 shadow-lg md:col-span-1">
              <CardContent className="p-6 flex flex-col items-center">
                <DataclausScoreGauge value={pkg.dataclausScore} size="lg" />
                <Badge
                  variant="outline"
                  className={`${statusVariant(pkg.status)} mt-3 capitalize`}
                >
                  {pkg.llmEvaluation.verdict}
                </Badge>
                <p className="text-xs text-slate-400 mt-1">
                  confidence: {pkg.llmEvaluation.confidence}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-panel border-0 shadow-lg md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {pkg.llmEvaluation.summary}
                </p>
                {pkg.llmEvaluation.red_flags.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-2">
                      Red Flags
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
                      Buyer Match
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
              </CardContent>
            </Card>
          </div>

          <Card className="glass-panel border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-base">Rubric Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(pkg.llmEvaluation.rubric).map(([k, v]) => (
                <div key={k} className="text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                    {k.replace(/_/g, ' ')}
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {v.toFixed(2)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="glass-panel border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base">Schema & Sample</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Schema
              </p>
              <pre className="bg-slate-50 rounded p-3 text-xs font-mono overflow-x-auto">
                {JSON.stringify(pkg.schemaJson, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                First Sample Row
              </p>
              <pre className="bg-slate-50 rounded p-3 text-xs font-mono overflow-x-auto">
                {JSON.stringify(pkg.sampleRows[0] ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PackageDetailPage() {
  return (
    <RequireAuth>
      <PackageDetailContent />
    </RequireAuth>
  );
}
