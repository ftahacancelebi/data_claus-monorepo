'use client';

import { useState } from 'react';
import { LedgerTable } from '@/components/user/LedgerTable';
import { Button } from '@/components/ui/button';
import { useMyLedger } from '@/lib/api-hooks';

const PAGE_SIZE = 50;

interface LedgerFilters {
  type?: string;
  from?: string;
  to?: string;
  applicationId?: string;
}

export default function EarningsHistoryPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<LedgerFilters>({});

  // queryKey includes both page and filters, so changing either triggers a
  // separate request and the previous one is kept warm in the cache.
  const ledgerQuery = useMyLedger({ ...filters, page, pageSize: PAGE_SIZE });

  const rows = ledgerQuery.data?.items ?? [];
  const total = ledgerQuery.data?.total ?? 0;
  const loading = ledgerQuery.isLoading || ledgerQuery.isFetching;
  const error = ledgerQuery.error?.message ?? null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Reset page when filters change so we don't end up on a now-empty page.
  const handleFilter = (next: LedgerFilters) => {
    setFilters(next);
    setPage(1);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Hesap hareketleri</h1>
        <p className="text-sm text-slate-500">
          Cüzdanına gelen ve çıkan tüm satırlar. Filtre uygula, CSV indir.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <LedgerTable rows={rows} onFilter={handleFilter} />

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {total} kayıt · sayfa {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Önceki
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sonraki
          </Button>
        </div>
      </div>
    </div>
  );
}
