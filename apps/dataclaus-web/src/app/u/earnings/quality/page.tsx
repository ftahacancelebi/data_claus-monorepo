'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { QualityScoreBadge } from '@/components/user/QualityScoreBadge';
import { useQualityHistory } from '@/lib/api-hooks';

export default function QualityHistoryPage() {
  const historyQuery = useQualityHistory(30);
  const history = historyQuery.data ?? [];
  const loading = historyQuery.isLoading;

  const avgQuality =
    history.length > 0
      ? history.reduce((acc, h) => acc + h.averageQuality, 0) / history.length
      : 0.5;

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Quality score</h1>
        <p className="text-sm text-slate-500">
          Son 30 günün ortalama quality score grafiği.
        </p>
      </header>

      <Card className="border-slate-100">
        <CardContent className="p-5 flex items-center gap-4">
          <QualityScoreBadge score={avgQuality} />
          <p className="text-xs text-slate-500">
            30 günlük ortalama. Cihazını gerçekten kullan, otomatik araçlardan
            kaçın → skor yükselir, kazancın da artar.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-100">
        <CardContent className="p-5">
          <div className="text-sm font-semibold text-slate-900 mb-3">
            Günlük kazanç (son 30 gün)
          </div>
          <div className="h-64">
            {loading ? (
              <div className="h-full w-full animate-pulse bg-slate-100 rounded" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => `$${value.toFixed(4)}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="earnings"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-100 bg-amber-50/40 border-amber-100">
        <CardContent className="p-5 space-y-2">
          <h3 className="text-sm font-semibold text-amber-900">
            Quality score nasıl artırılır?
          </h3>
          <ul className="text-xs text-amber-900/80 list-disc pl-4 space-y-1">
            <li>Cihazını gerçekten kullan; emülatör veya otomasyon riskli.</li>
            <li>
              Hızlı, mekanik dokunuşlar yerine doğal etkileşim kazandırır.
            </li>
            <li>
              Tek cihaz, çoklu app. Aynı anda birden çok cihazda oturum
              skorunu düşürebilir.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
