'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtime, type WalletCreditedEvent } from '@/lib/realtime';
import { Card, CardContent } from '@/components/ui/card';
import { Lightning } from 'phosphor-react';
import { formatMoney } from '@/lib/types';
import { queryKeys } from '@/lib/query-keys';
import type { EarningsSummary } from '@/lib/api-hooks';
import type { EarningsByApp } from '@/lib/api';

interface TickerEntry {
  id: string;
  amount: number;
  source: string;
  at: string;
}

export function LiveTicker({ userId }: { userId: string }) {
  const { on, status } = useRealtime();
  const qc = useQueryClient();
  const [events, setEvents] = useState<TickerEntry[]>([]);

  useEffect(() => {
    return on<WalletCreditedEvent>('wallet:credited', (payload) => {
      if (payload.userId !== userId) return;
      const amount = Number(payload.userShare ?? payload.grossRevenue ?? 0);
      if (!amount) return;

      // 1) Local ticker UI (independent of cache).
      setEvents((prev) =>
        [
          {
            id: `${payload.impressionId ?? Math.random()}`,
            amount,
            source: payload.adType ?? 'ad',
            at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 5),
      );

      // 2) Patch the earnings summary in the React Query cache so that
      //    EarningsHeroCard, /u/withdraw, and any other panel reading
      //    this key updates in the same render cycle.
      //    This is THE fix for "API güncellenir, state güncellenmez".
      qc.setQueryData<EarningsSummary | undefined>(
        queryKeys.earnings.summary(),
        (prev) =>
          prev
            ? {
                ...prev,
                balance: Number(prev.balance) + amount,
                totalEarned: Number(prev.totalEarned) + amount,
              }
            : prev,
      );

      // 3) Patch by-app earnings if we know which app fired the event.
      const appId = payload.applicationId;
      if (appId) {
        qc.setQueryData<EarningsByApp[] | undefined>(
          queryKeys.earnings.byApp(),
          (prev) =>
            prev
              ? prev.map((row) =>
                  row.applicationId === appId
                    ? {
                        ...row,
                        totalEarned: Number(row.totalEarned) + amount,
                        last7Days: Number(row.last7Days) + amount,
                        impressionCount: row.impressionCount + 1,
                      }
                    : row,
                )
              : prev,
        );
      }

      // 4) Mark ledger stale — the new entry will appear on next visit
      //    or on the next focus refetch. We don't patch the ledger inline
      //    because pagination makes optimistic insertion error-prone.
      qc.invalidateQueries({ queryKey: queryKeys.ledger.all });
    });
  }, [on, userId, qc]);

  // On reconnect, server may have buffered events we missed; resync earnings.
  useEffect(() => {
    if (status === 'connected') {
      qc.invalidateQueries({ queryKey: queryKeys.earnings.all });
    }
  }, [status, qc]);

  return (
    <Card className="border-slate-100">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lightning size={16} weight="fill" className="text-amber-500" />
            <span className="text-sm font-semibold text-slate-900">
              Canlı kazanç akışı
            </span>
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider font-bold ${
              status === 'connected'
                ? 'text-emerald-600'
                : status === 'connecting'
                  ? 'text-amber-600'
                  : 'text-slate-400'
            }`}
          >
            {status}
          </span>
        </div>
        <div className="space-y-2 min-h-[120px]">
          {events.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              Bağlandın. Bir reklam izlendiğinde kazanç anında burada belirir.
            </p>
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between text-sm border-b border-slate-50 pb-1 last:border-b-0"
              >
                <span className="text-slate-600 capitalize">{e.source}</span>
                <span className="font-semibold text-emerald-600">
                  +{formatMoney(e.amount, 6)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
