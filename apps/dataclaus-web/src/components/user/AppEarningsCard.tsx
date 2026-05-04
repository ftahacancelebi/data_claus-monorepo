'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CaretRight, AppWindow } from 'phosphor-react';
import { QualityScoreBadge } from './QualityScoreBadge';
import { formatMoney } from '@/lib/types';
import type { EarningsByApp } from '@/lib/api';

interface Props {
  app: EarningsByApp;
  onSelect?: (applicationId: string) => void;
}

export function AppEarningsCard({ app, onSelect }: Props) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(app.applicationId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect?.(app.applicationId);
      }}
      className="cursor-pointer hover:border-primary/40 hover:shadow-md transition group"
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-primary flex items-center justify-center">
          <AppWindow size={20} weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 truncate">
              {app.appName}
            </h3>
            <QualityScoreBadge score={app.qualityScoreAvg} size="sm" />
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {app.category ?? 'Uncategorized'} · {app.impressionCount} impressions
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-slate-900">
            {formatMoney(app.totalEarned, 4)}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            +{formatMoney(app.last7Days, 4)} bu hafta
          </div>
        </div>
        <CaretRight
          size={16}
          className="text-slate-400 group-hover:text-primary transition"
        />
      </CardContent>
    </Card>
  );
}
