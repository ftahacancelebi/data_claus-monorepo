'use client';

import { useState } from 'react';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export default function DataRightsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const token = getToken();
      if (!token) {
        setStatus('Oturum açmanız gerekiyor.');
        return;
      }
      const res = await fetch(`${API_BASE}/me/data-export`, {
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
    } finally {
      setBusy(false);
    }
  };

  const requestDeletion = async () => {
    if (
      !confirm(
        'Hesabınızın silinmesini istediğinize emin misiniz? 30 gün boyunca geri alabilirsiniz.',
      )
    )
      return;
    setBusy(true);
    setStatus(null);
    try {
      const token = getToken();
      if (!token) {
        setStatus('Oturum açmanız gerekiyor.');
        return;
      }
      const res = await fetch(`${API_BASE}/me/account/delete-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setStatus(`Hata: HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      setStatus(
        `Silme zamanlandı. Geri alma süresi: ${new Date(
          json.deleteAfter,
        ).toLocaleString('tr-TR')}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelDeletion = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const token = getToken();
      if (!token) {
        setStatus('Oturum açmanız gerekiyor.');
        return;
      }
      const res = await fetch(`${API_BASE}/me/account/delete-request`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setStatus(`Hata: HTTP ${res.status}`);
        return;
      }
      setStatus('Silme talebi iptal edildi.');
    } finally {
      setBusy(false);
    }
  };

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
            disabled={busy}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            JSON Olarak İndir
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
              disabled={busy}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            >
              Silme Talebi Gönder
            </button>
            <button
              onClick={cancelDeletion}
              disabled={busy}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              Bekleyen Talebi İptal Et
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
