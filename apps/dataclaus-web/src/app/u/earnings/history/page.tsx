'use client';

import { useCallback, useEffect, useState } from 'react';
import { LedgerTable } from '@/components/user/LedgerTable';
import { Button } from '@/components/ui/button';
import { getMyLedger, type LedgerEntry } from '@/lib/api';

const PAGE_SIZE = 50;

export default function EarningsHistoryPage() {
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<{
    type?: string;
    from?: string;
    to?: string;
    applicationId?: string;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (next: number, f: typeof filters) => {
      try {
        setLoading(true);
        setError(null);
        const res = await getMyLedger({ ...f, page: next, pageSize: PAGE_SIZE });
        setRows(res.items);
        setTotal(res.total);
        setPage(res.page);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(1, filters);
  }, [load, filters]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

      <LedgerTable rows={rows} onFilter={setFilters} />

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {total} kayıt · sayfa {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page <= 1}
            onClick={() => load(page - 1, filters)}
          >
            Önceki
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || page >= totalPages}
            onClick={() => load(page + 1, filters)}
          >
            Sonraki
          </Button>
        </div>
      </div>
    </div>
  );
}
