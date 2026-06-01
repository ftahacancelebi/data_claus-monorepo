'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMyPurchases } from '@/lib/api-hooks';
import { fetchPackageDownload } from '@/lib/api';
import { RequireAuth } from '@/lib/route-guards';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorPanel } from '@/components/layout/error-panel';
import { useToast } from '@/components/ui/use-toast';
import { Download, FileJson, FileText } from 'lucide-react';

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PurchaseRow({ p }: { p: ReturnType<typeof useMyPurchases>['data'] extends (infer T)[] | undefined ? T : never }) {
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null);
  const { toast } = useToast();

  const download = async (format: 'csv' | 'json') => {
    if (!p.downloadToken) {
      toast({ title: 'No download token', description: 'Re-purchase to get a fresh token.', variant: 'destructive' });
      return;
    }
    setBusy(format);
    try {
      const result = await fetchPackageDownload(p.packageId, p.downloadToken);
      const rows = result.package.sample_rows;
      const slug = (result.package.title ?? 'package').toLowerCase().replace(/\s+/g, '-');
      const filename = `${slug}-${result.purchase.id.slice(0, 8)}.${format}`;

      if (format === 'csv') {
        triggerDownload(rowsToCsv(rows), filename, 'text/csv');
      } else {
        triggerDownload(
          JSON.stringify({ meta: result.package, rows, purchase: result.purchase }, null, 2),
          filename,
          'application/json',
        );
      }
    } catch (err) {
      toast({
        title: 'Download failed',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="glass-panel border-0 shadow-md">
      <CardContent className="p-5 flex items-center gap-4 flex-wrap">
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

        {p.downloadToken ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => download('csv')}
            >
              {busy === 'csv' ? (
                <span className="animate-pulse">…</span>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  CSV
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => download('json')}
            >
              {busy === 'json' ? (
                <span className="animate-pulse">…</span>
              ) : (
                <>
                  <FileJson className="h-3.5 w-3.5 mr-1.5" />
                  JSON
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Download className="h-3.5 w-3.5" />
            No token
          </div>
        )}

        {p.package && (
          <Link
            href={`/dashboard/marketplace/${p.package.id}`}
            className="text-sm text-primary hover:underline whitespace-nowrap"
          >
            View →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function PurchasesContent() {
  const { data, isLoading, isError, error, refetch } = useMyPurchases();

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

  const purchases = data ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Your Purchases
        </h1>
        <p className="text-slate-500 mt-1">
          Datasets you&apos;ve bought from the marketplace. Download as CSV or JSON.
        </p>
        {purchases.length > 0 && (
          <p className="text-xs text-slate-400 mt-1">
            Downloads contain sample rows (preview dataset). Full data export available for enterprise plans.
          </p>
        )}
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
            <PurchaseRow key={p.id} p={p} />
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
