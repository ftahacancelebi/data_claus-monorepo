'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download } from 'phosphor-react';
import { formatMoney } from '@/lib/types';
import type { LedgerEntry } from '@/lib/api';

interface Props {
  rows: LedgerEntry[];
  onFilter?: (filters: {
    type?: string;
    from?: string;
    to?: string;
    applicationId?: string;
  }) => void;
}

const TYPES = ['all', 'payout', 'deposit', 'fee', 'transfer', 'ad_revenue'];

function toCsv(rows: LedgerEntry[]): string {
  const header =
    'date,type,application,amount,currency,status,reference_id,id\n';
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows
    .map((r) =>
      [
        r.date,
        r.type,
        r.applicationName ?? '',
        r.amount,
        r.currency,
        r.status,
        r.referenceId ?? '',
        r.id,
      ]
        .map(escape)
        .join(','),
    )
    .join('\n');
  return header + body + '\n';
}

export function LedgerTable({ rows, onFilter }: Props) {
  const [type, setType] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');

  const apply = () => {
    onFilter?.({
      type: type === 'all' ? undefined : type,
      from: from || undefined,
      to: to || undefined,
    });
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataclaus-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">From</label>
          <Input
            type="date"
            className="h-9 w-44"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">To</label>
          <Input
            type="date"
            className="h-9 w-44"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={apply}>
          Apply
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          <Download size={14} className="mr-1" /> CSV
        </Button>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Application</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-slate-500 py-8 text-sm"
                >
                  Henüz ledger kaydı yok. Kazanç oluştuğunda burada görünür.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(r.date).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs uppercase tracking-wide text-slate-700">
                    {r.type}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.applicationName ?? '—'}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      r.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {r.amount >= 0 ? '+' : ''}
                    {formatMoney(r.amount, 4)} {r.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {r.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
