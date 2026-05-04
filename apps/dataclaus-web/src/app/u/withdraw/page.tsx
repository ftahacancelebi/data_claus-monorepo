'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WithdrawModal } from '@/components/wallet/withdraw-modal';
import {
  getMyEarningsSummary,
  listMyPayouts,
  type PayoutRecord,
} from '@/lib/api';
import { formatMoney } from '@/lib/types';
import { Wallet, Receipt } from 'phosphor-react';

const MIN_WITHDRAW = 0.01;

export default function WithdrawPage() {
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [pending, setPending] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [history, setHistory] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        getMyEarningsSummary().catch(() => null),
        listMyPayouts().catch(() => [] as PayoutRecord[]),
      ]);
      if (s) {
        setBalance(Number(s.balance));
        setPending(Number(s.pendingBalance));
        setCurrency(s.currency);
      }
      setHistory(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const canWithdraw = balance >= MIN_WITHDRAW;

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Withdraw</h1>
        <p className="text-sm text-slate-500">
          Bakiyeni banka veya kripto cüzdana çek. Stripe simülasyon
          modunda çalışıyor — gerçek para hareketi yok.
        </p>
      </header>

      <Card className="border-slate-100 overflow-hidden">
        <CardContent className="p-6 grid sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
              <Wallet size={12} weight="duotone" /> Çekilebilir
            </div>
            <div className="text-3xl font-bold text-slate-900">
              {formatMoney(balance, 4)}
            </div>
            <div className="text-xs text-slate-400">{currency}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Beklemede
            </div>
            <div className="text-xl font-semibold text-amber-600">
              {formatMoney(pending, 6)}
            </div>
            <div className="text-[10px] text-slate-400">
              Eşik üstüne çıkınca çekilebilir
            </div>
          </div>
          <div className="flex items-end justify-end">
            <Button
              size="lg"
              disabled={!canWithdraw}
              onClick={() => setOpen(true)}
            >
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      {!canWithdraw && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Withdraw için en az {formatMoney(MIN_WITHDRAW, 2)} bakiye gerekli.
          Şu anki bakiyen: {formatMoney(balance, 4)}.
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Geçmiş</h2>
        <div className="space-y-2">
          {loading ? (
            <Card className="border-slate-100 animate-pulse h-20" />
          ) : history.length === 0 ? (
            <Card className="border-dashed border-slate-200">
              <CardContent className="p-6 text-center">
                <Receipt
                  size={28}
                  weight="duotone"
                  className="mx-auto text-slate-400"
                />
                <p className="text-sm text-slate-500 mt-2">
                  Henüz çekim isteği oluşturmadın.
                </p>
              </CardContent>
            </Card>
          ) : (
            history.map((p) => (
              <Card key={p.id} className="border-slate-100">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatMoney(Number(p.amount), 4)} {p.currency}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(p.requested_at).toLocaleString()} ·{' '}
                      {p.method === 'bank_simulation' ? 'Bank' : 'Crypto'}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      p.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : p.status === 'rejected' || p.status === 'failed'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                    }
                  >
                    {p.status}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <WithdrawModal
        open={open}
        onClose={() => {
          setOpen(false);
          load();
        }}
        availableBalance={balance}
        currency={currency}
        onSuccess={() => load()}
      />
    </div>
  );
}
