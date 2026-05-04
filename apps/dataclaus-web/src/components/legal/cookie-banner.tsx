'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'dc_consent';
type Consent = 'accepted' | 'rejected';

export function CookieBanner() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = (typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null) as Consent | null;
    setConsent(stored);
    setHydrated(true);
  }, []);

  const decide = (choice: Consent) => {
    localStorage.setItem(STORAGE_KEY, choice);
    setConsent(choice);
    if (choice === 'accepted') {
      // Hook for analytics SDKs — only loaded after explicit consent.
      window.dispatchEvent(new CustomEvent('dc:consent:accepted'));
    } else {
      window.dispatchEvent(new CustomEvent('dc:consent:rejected'));
    }
  };

  if (!hydrated || consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-800 bg-slate-950/95 px-6 py-4 text-sm text-slate-200 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="leading-relaxed">
          Bu site, hizmeti çalıştırmak için zorunlu çerezler ve isteğe
          bağlı analitik çerezler kullanır. Detay için
          <a className="ml-1 text-emerald-400 underline" href="/legal/cookies">
            çerez politikası
          </a>
          .
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => decide('rejected')}
            className="rounded-lg border border-slate-700 px-3 py-2 hover:bg-slate-800"
          >
            Reddet
          </button>
          <button
            onClick={() => decide('accepted')}
            className="rounded-lg bg-emerald-500 px-3 py-2 font-medium text-slate-950 hover:bg-emerald-400"
          >
            Kabul Et
          </button>
        </div>
      </div>
    </div>
  );
}
