'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EarningsHeroCard } from '@/components/user/EarningsHeroCard';
import { LiveTicker } from '@/components/user/LiveTicker';
import { QualityScoreBadge } from '@/components/user/QualityScoreBadge';
import { AppEarningsCard } from '@/components/user/AppEarningsCard';
import {
  getMyEarningsByApp,
  getMyEarningsSummary,
  getMyQualityHistory,
  type EarningsByApp,
  type QualityHistoryPoint,
} from '@/lib/api';
import { CaretRight, AppWindow } from 'phosphor-react';

interface Summary {
  balance: number;
  pendingBalance: number;
  totalEarned: number;
  currency: string;
}

export default function UserDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [apps, setApps] = useState<EarningsByApp[]>([]);
  const [history, setHistory] = useState<QualityHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
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
      } catch (err) {
        setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const last7Days = history.map((h) => ({ date: h.date, earnings: h.earnings }));
  const totalQuality =
    history.length > 0
      ? history.reduce((acc, h) => acc + h.averageQuality, 0) / history.length
      : 0.5;

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900">
          Hoş geldin{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="text-sm text-slate-500">
          Verilerin senin. Aşağıda son 7 günün kazancı ve aktif uygulamaların.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <EarningsHeroCard
        totalEarned={summary?.totalEarned ?? 0}
        availableBalance={summary?.balance ?? 0}
        pendingBalance={summary?.pendingBalance ?? 0}
        currency={summary?.currency ?? 'USD'}
        last7Days={last7Days}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LiveTicker userId={user?.id ?? ''} />
        </div>
        <Card className="border-slate-100">
          <CardContent className="p-5 space-y-3">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Quality score
            </div>
            <QualityScoreBadge score={totalQuality} />
            <p className="text-xs text-slate-500 leading-relaxed">
              Quality score, ne kadar &quot;gerçek kullanıcı&quot; gibi
              davrandığını ölçer. Yüksek skor → daha çok kazanç.
            </p>
            <Link
              href="/u/earnings/quality"
              className="text-xs text-primary inline-flex items-center gap-1"
            >
              Detay <CaretRight size={12} />
            </Link>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Bağlı uygulamalar
          </h2>
          <Link
            href="/u/earnings/by-app"
            className="text-sm text-primary inline-flex items-center gap-1"
          >
            Tümü <CaretRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1].map((i) => (
              <Card key={i} className="border-slate-100 animate-pulse h-20" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <Card className="border-dashed border-slate-200">
            <CardContent className="p-8 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-blue-50 text-primary flex items-center justify-center">
                <AppWindow size={24} weight="duotone" />
              </div>
              <h3 className="font-semibold text-slate-900">
                Henüz hiçbir uygulamaya bağlı değilsin
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                DataClaus SDK&apos;sini kullanan uygulamalardan birinde
                hesabınla giriş yap. Aynı kimlik, tek cüzdan.
              </p>
              <Button size="sm">İlk uygulamayı bağla</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {apps.slice(0, 4).map((app) => (
              <AppEarningsCard key={app.applicationId} app={app} />
            ))}
          </div>
        )}
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <Link href="/u/withdraw">
          <Card className="hover:border-primary/40 transition cursor-pointer">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-slate-900">
                Withdraw
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Bakiyeni banka veya kripto cüzdana çek.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/u/sessions">
          <Card className="hover:border-primary/40 transition cursor-pointer">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-slate-900">
                Aktif oturumlar
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Hangi cihazlarda giriş yaptığını gör, çıkış yap.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/u/account">
          <Card className="hover:border-primary/40 transition cursor-pointer">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-slate-900">
                Hesap ayarları
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Profil, gizlilik, KVKK hakların.
              </p>
            </CardContent>
          </Card>
        </Link>
      </section>
    </div>
  );
}
