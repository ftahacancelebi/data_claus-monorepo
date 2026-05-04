'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'phosphor-react';
import {
  getMyEarningsByApp,
  getMyEarningsSummary,
  getMyQualityHistory,
  type EarningsByApp,
  type QualityHistoryPoint,
} from '@/lib/api';
import { formatMoney } from '@/lib/types';
import { EarningsHeroCard } from '@/components/user/EarningsHeroCard';

interface Summary {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  currency: string;
}

const tabs = [
  {
    href: '/u/earnings/by-app',
    label: 'By app',
    desc: 'Hangi uygulamadan ne kadar geldi',
  },
  {
    href: '/u/earnings/history',
    label: 'History',
    desc: 'Tüm ledger satırları, filtre, CSV',
  },
  {
    href: '/u/earnings/quality',
    label: 'Quality',
    desc: 'Quality score zaman çizelgesi',
  },
];

export default function EarningsOverviewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [apps, setApps] = useState<EarningsByApp[]>([]);
  const [history, setHistory] = useState<QualityHistoryPoint[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [s, a, h] = await Promise.all([
        getMyEarningsSummary().catch(() => null),
        getMyEarningsByApp().catch(() => []),
        getMyQualityHistory(7).catch(() => []),
      ]);
      if (!active) return;
      if (s) {
        setSummary({
          balance: Number(s.balance),
          pendingBalance: Number(s.pendingBalance),
          totalEarned: Number(s.totalEarned),
          currency: s.currency,
        });
      }
      setApps(a);
      setHistory(h);
    })();
    return () => {
      active = false;
    };
  }, []);

  const last7Days = history.map((h) => ({ date: h.date, earnings: h.earnings }));

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Kazanç</h1>
        <p className="text-sm text-slate-500">
          Toplam kazancın {formatMoney(summary?.totalEarned ?? 0, 2)} ·{' '}
          {apps.length} bağlı uygulama
        </p>
      </header>

      <EarningsHeroCard
        totalEarned={summary?.totalEarned ?? 0}
        availableBalance={summary?.balance ?? 0}
        pendingBalance={summary?.pendingBalance ?? 0}
        currency={summary?.currency ?? 'USD'}
        last7Days={last7Days}
      />

      <div className="grid sm:grid-cols-3 gap-3">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="hover:border-primary/40 transition cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    {t.label}
                  </span>
                  <ArrowRight size={14} className="text-slate-400" />
                </div>
                <p className="text-xs text-slate-500 mt-2">{t.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
