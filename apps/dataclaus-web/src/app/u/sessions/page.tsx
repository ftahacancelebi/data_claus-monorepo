'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SessionCard } from '@/components/user/SessionCard';
import {
  useMySessions,
  useRevokeAllSessions,
  useRevokeSession,
} from '@/lib/api-hooks';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SessionsPage() {
  const { logout } = useAuth();
  const router = useRouter();

  const sessionsQuery = useMySessions();
  const revokeMutation = useRevokeSession();
  const revokeAllMutation = useRevokeAllSessions();

  const sessions = sessionsQuery.data ?? [];
  const loading = sessionsQuery.isLoading;
  // Surface either the load error or the most recent mutation error.
  const [mutationError, setMutationError] = useState<string | null>(null);
  const error = mutationError ?? sessionsQuery.error?.message ?? null;

  const handleRevoke = async (id: string) => {
    setMutationError(null);
    try {
      await revokeMutation.mutateAsync(id);
    } catch (err) {
      setMutationError((err as Error).message);
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('Tüm cihazlardan çıkış yap?')) return;
    setMutationError(null);
    try {
      await revokeAllMutation.mutateAsync();
      logout();
      router.push('/');
    } catch (err) {
      setMutationError((err as Error).message);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Oturumlar</h1>
          <p className="text-sm text-slate-500">
            Hesabına bağlı son cihazlar. Şüpheli bir oturum görüyorsan tek tek
            ya da topluca çıkış yapabilirsin.
          </p>
        </div>
        {sessions.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleLogoutAll}>
            Tüm cihazlardan çık
          </Button>
        )}
      </header>

      {error && (
        <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Card className="border-slate-100 animate-pulse h-20" />
          <Card className="border-slate-100 animate-pulse h-20" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed border-slate-200">
          <CardContent className="p-8 text-center text-sm text-slate-500">
            Aktif oturum bulunamadı.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onRevoke={handleRevoke} />
          ))}
        </div>
      )}
    </div>
  );
}
