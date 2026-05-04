'use client';

import { useEffect, useState } from 'react';
import { useRealtime, type WalletCreditedEvent } from '@/lib/realtime';
import { Card, CardContent } from '@/components/ui/card';
import { Lightning } from 'phosphor-react';
import { formatMoney } from '@/lib/types';

interface TickerEntry {
  id: string;
  amount: number;
  source: string;
  at: string;
}

export function LiveTicker({ userId }: { userId: string }) {
  const { on, status } = useRealtime();
  const [events, setEvents] = useState<TickerEntry[]>([]);

  useEffect(() => {
    return on<WalletCreditedEvent>('wallet:credited', (payload) => {
      if (payload.userId !== userId) return;
      const amount = Number(payload.userShare ?? payload.grossRevenue ?? 0);
      if (!amount) return;
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
    });
  }, [on, userId]);

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
