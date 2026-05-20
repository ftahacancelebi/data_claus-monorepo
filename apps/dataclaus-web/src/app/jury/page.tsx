'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const DEMO_PASSWORD = 'demo1234';

interface JuryRole {
  label: string;
  email: string;
  description: string;
  redirectPath: string;
  accent: string;
}

const ROLES: JuryRole[] = [
  {
    label: 'End-User Demo',
    email: 'user.alice@dataclaus.demo',
    description:
      'See the wallet, earnings history, withdraw flow exactly as a real user does.',
    redirectPath: '/u/dashboard',
    accent: 'from-emerald-500 to-emerald-600',
  },
  {
    label: 'Developer Demo',
    email: 'developer.social@dataclaus.demo',
    description:
      'TikTok Clone publisher. View applications, revenue share configuration, and webhooks.',
    redirectPath: '/dashboard/my-apps',
    accent: 'from-indigo-500 to-indigo-600',
  },
  {
    label: 'Buyer Demo',
    email: 'buyer.brandone@dataclaus.demo',
    description:
      'Marketing buyer with a topped-up wallet, browsing campaign performance.',
    redirectPath: '/dashboard/marketplace',
    accent: 'from-amber-500 to-amber-600',
  },
  {
    label: 'Admin Demo',
    email: 'admin@dataclaus.demo',
    description:
      'Platform operator. Stats, users, ledger invariant, live health page.',
    redirectPath: '/dashboard/admin/health',
    accent: 'from-rose-500 to-rose-600',
  },
];

export default function JuryPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const loginAs = async (role: JuryRole) => {
    setBusy(role.label);
    setError('');
    try {
      // Go through the AuthProvider's login(), not a hand-rolled fetch.
      // It sets in-memory auth state (status='authed') AND localStorage in
      // the same tick. The previous code only wrote localStorage, so the
      // soft client-side router.push() never re-ran AuthProvider's
      // hydration effect — RequireRole still saw `guest` and bounced every
      // jury click straight back to `/`. login() is the single auth path.
      const authUser = await login(role.email, DEMO_PASSWORD);

      // Route by the real role returned from the backend so a mis-seeded
      // account can't strand the jury on the wrong portal.
      const target =
        authUser.role === 'user'
          ? '/u/dashboard'
          : authUser.role === 'admin'
          ? '/dashboard/admin/health'
          : authUser.role === 'buyer'
          ? '/dashboard/marketplace'
          : role.redirectPath;
      router.push(target);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="inline-block bg-white/10 border border-white/20 rounded-full px-4 py-1 text-xs uppercase tracking-widest mb-4">
            Capstone Jury Console
          </div>
          <h1 className="text-4xl font-bold mb-2">DataClaus Demo Console</h1>
          <p className="text-slate-300 max-w-2xl">
            One-click access to every persona in the platform. All accounts use
            the password{' '}
            <code className="bg-white/10 px-2 py-0.5 rounded">demo1234</code>.
            Run{' '}
            <code className="bg-white/10 px-2 py-0.5 rounded">
              pnpm run demo:seed
            </code>{' '}
            first if these accounts don&apos;t exist yet.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/40 text-red-100 rounded-md p-4 mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ROLES.map((role) => (
            <button
              key={role.label}
              onClick={() => loginAs(role)}
              disabled={busy !== null}
              className="text-left bg-white/5 border border-white/10 hover:border-white/30 rounded-xl p-6 transition disabled:opacity-50"
            >
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${role.accent} font-bold mb-4`}
              >
                {role.label[0]}
              </div>
              <div className="text-xl font-semibold mb-1">{role.label}</div>
              <div className="text-sm text-slate-400 mb-3">{role.email}</div>
              <p className="text-sm text-slate-300">{role.description}</p>
              <div className="mt-4 text-xs text-slate-400">
                {busy === role.label
                  ? 'Logging in…'
                  : `→ ${role.redirectPath}`}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="font-semibold mb-1">Live health</div>
            <a
              href="/dashboard/admin/health"
              className="text-indigo-300 hover:underline"
            >
              /dashboard/admin/health →
            </a>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="font-semibold mb-1">Swagger / API docs</div>
            <a
              href="http://localhost:3000/api/docs"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-300 hover:underline"
            >
              http://localhost:3000/api/docs →
            </a>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="font-semibold mb-1">Replay tool</div>
            <code className="text-slate-300">pnpm run demo:replay</code>
          </div>
        </div>
      </div>
    </div>
  );
}
