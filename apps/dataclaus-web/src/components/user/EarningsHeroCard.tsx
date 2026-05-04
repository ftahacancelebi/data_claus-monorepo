'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Wallet, TrendUp } from 'phosphor-react';
import { formatMoney } from '@/lib/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  totalEarned: number;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  last7Days: { date: string; earnings: number }[];
}

export function EarningsHeroCard({
  totalEarned,
  availableBalance,
  pendingBalance,
  currency,
  last7Days,
}: Props) {
  const sumLast7 = last7Days.reduce((acc, p) => acc + p.earnings, 0);

  return (
    <Card className="overflow-hidden border-slate-100 shadow-sm bg-gradient-to-br from-white to-blue-50/40">
      <CardContent className="p-6 grid md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">
            <Wallet size={14} weight="duotone" /> Bu hafta kazanç
          </div>
          <div className="text-4xl font-bold text-slate-900">
            {formatMoney(sumLast7, 2)}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Bu, normalde Big Tech&apos;e gidiyordu. Artık senin.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase text-slate-500 font-semibold tracking-wider">
            <TrendUp size={14} weight="duotone" /> Toplam kazanç
          </div>
          <div className="text-2xl font-bold text-slate-700">
            {formatMoney(totalEarned, 2)}
          </div>
          <div className="text-xs text-slate-500">
            Çekilebilir: {formatMoney(availableBalance, 2)} {currency}
          </div>
          {pendingBalance > 0 && (
            <div className="text-xs text-amber-600">
              Beklemede: {formatMoney(pendingBalance, 6)} (eşik altında)
            </div>
          )}
        </div>

        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={last7Days}>
              <defs>
                <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => formatMoney(value, 4)}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              />
              <Area
                type="monotone"
                dataKey="earnings"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#hero-fill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
