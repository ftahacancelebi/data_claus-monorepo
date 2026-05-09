'use client';

import { useState } from 'react';
import {
  useCancelAccountDeletion,
  useRequestAccountDeletion,
} from '@/lib/api-hooks';

/**
 * Reads the auth token using the same keys as `lib/api.ts` and
 * `auth-context.tsx`. The legacy `'accessToken'` key here was a bug —
 * it was never set, so this page silently 401'd.
 */
function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem('dataclaus_token') ||
    window.localStorage.getItem('dataclaus_user_access_token')
  );
}

export default function DataRightsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Account deletion goes through the React Query mutation hooks so the
  // status invalidates the same way it does in /u/account.
  const requestDeleteMutation = useRequestAccountDeletion();
  const cancelDeleteMutation = useCancelAccountDeletion();

  const exportData = async () => {
    setStatus(null);
    setExporting(true);
    try {
      const token = readToken();
      if (!token) {
        setStatus('Oturum açmanız gerekiyor.');
        return;
      }
      // Goes through the Next.js rewrite (/api → backend) so cookies and
      // CORS work the same way they do for the rest of the app.
      const res = await fetch('/api/me/data-export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setStatus(`Hata: HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dataclaus-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Dışa aktarma tamamlandı.');
    } catch (err) {
      setStatus(`Hata: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
    } finally {
      setExporting(false);
    }
  };

  const requestDeletion = async () => {
    if (
      !confirm(
        'Hesabınızın silinmesini istediğinize emin misiniz? 30 gün boyunca geri alabilirsiniz.',
      )
    )
      return;
    setStatus(null);
    try {
      await requestDeleteMutation.mutateAsync();
      setStatus('Silme talebi alındı. 30 gün içinde geri alabilirsiniz.');
    } catch (err) {
      setStatus(`Hata: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
    }
  };

  const cancelDeletion = async () => {
    setStatus(null);
    try {
      await cancelDeleteMutation.mutateAsync();
      setStatus('Silme talebi iptal edildi.');
    } catch (err) {
      setStatus(`Hata: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`);
    }
  };

  const requestPending = requestDeleteMutation.isPending;
  const cancelPending = cancelDeleteMutation.isPending;
  const anyBusy = exporting || requestPending || cancelPending;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-200">
      <h1 className="mb-2 text-3xl font-semibold">Veri Hakları</h1>
      <p className="mb-8 text-sm text-slate-400">
        KVKK Md. 11 ve GDPR Md. 15-22 kapsamındaki haklarınızı buradan
        kullanabilirsiniz.
      </p>

      <div className="space-y-6">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="mb-2 text-lg font-semibold">Verilerimi Dışa Aktar</h2>
          <p className="mb-4 text-sm text-slate-400">
            Hesabınıza bağlı tüm verilerin (profil, cüzdan, ledger, scored
            events, payouts) JSON kopyasını indirin.
          </p>
          <button
            onClick={exportData}
            disabled={anyBusy}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {exporting ? 'İndiriliyor…' : 'JSON Olarak İndir'}
          </button>
        </section>

        <section className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-6">
          <h2 className="mb-2 text-lg font-semibold">Hesabımı Sil</h2>
          <p className="mb-4 text-sm text-slate-400">
            Silme talebi 30 gün boyunca geri alınabilir. Bu süre sonunda
            kişisel verileriniz kalıcı olarak silinir.
          </p>
          <div className="flex gap-3">
            <button
              onClick={requestDeletion}
              disabled={anyBusy}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {requestPending ? 'Talep gönderiliyor…' : 'Silme Talebi Gönder'}
            </button>
            <button
              onClick={cancelDeletion}
              disabled={anyBusy}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {cancelPending ? 'İptal ediliyor…' : 'Bekleyen Talebi İptal Et'}
            </button>
          </div>
        </section>

        {status && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}
