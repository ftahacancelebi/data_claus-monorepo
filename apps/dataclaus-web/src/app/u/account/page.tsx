'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import {
  cancelAccountDeletion,
  requestAccountDeletion,
} from '@/lib/api';
import { ShieldCheck, Download, Trash } from 'phosphor-react';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [deletionStatus, setDeletionStatus] = useState<
    'idle' | 'requested' | 'cancelled'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const downloadExport = async () => {
    setError(null);
    setBusy(true);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('dataclaus_token') ||
            localStorage.getItem('dataclaus_user_access_token')
          : null;
      const res = await fetch('/api/me/data-export', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dataclaus-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const requestDelete = async () => {
    if (
      !confirm(
        'Hesabını silmek istediğine emin misin? 30 günlük cooling-off süresi başlar.',
      )
    )
      return;
    try {
      await requestAccountDeletion();
      setDeletionStatus('requested');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cancelDelete = async () => {
    try {
      await cancelAccountDeletion();
      setDeletionStatus('cancelled');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Hesap</h1>
        <p className="text-sm text-slate-500">
          Profil ayarları, gizlilik tercihleri ve KVKK / GDPR hakların.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Card className="border-slate-100">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Profil</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ad</Label>
              <Input value={user?.name ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input value={user?.email ?? ''} disabled />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Profil düzenleme yakında. Bu sürümde değişiklikler destek
            kanalı üzerinden yapılır.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-100">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} weight="duotone" className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Veri hakların (KVKK / GDPR)
            </h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tüm verilerini JSON olarak indirebilir veya hesabını silmeyi
            isteyebilirsin. Silme talebi 30 gün cooling-off süresi başlatır;
            bu süre içinde geri alabilirsin.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={downloadExport}
              disabled={busy}
            >
              <Download size={14} className="mr-1" /> Verilerimi indir
            </Button>
            {deletionStatus === 'requested' ? (
              <Button size="sm" variant="outline" onClick={cancelDelete}>
                Silme talebini iptal et
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={requestDelete}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                <Trash size={14} className="mr-1" /> Hesabımı sil
              </Button>
            )}
          </div>
          {deletionStatus === 'requested' && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200"
            >
              30 gün cooling-off başladı
            </Badge>
          )}
          {deletionStatus === 'cancelled' && (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              Silme talebi iptal edildi
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-100">
        <CardContent className="p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Oturum</h2>
          <p className="text-xs text-slate-500">
            Bu cihazdan çıkmak için aşağıdaki düğmeyi kullan. Diğer
            cihazlardan toplu çıkış için &quot;Sessions&quot; sayfasını gör.
          </p>
          <Button variant="ghost" size="sm" onClick={logout}>
            Çıkış yap
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
