'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeviceMobile, MapPin, Clock } from 'phosphor-react';
import type { UserSession } from '@/lib/api';

interface Props {
  session: UserSession;
  onRevoke?: (id: string) => void;
}

export function SessionCard({ session, onRevoke }: Props) {
  return (
    <Card className="border-slate-100">
      <CardContent className="p-5 flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
          <DeviceMobile size={20} weight="duotone" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-slate-900 truncate">
              {session.userAgent ?? 'Unknown device'}
            </h4>
            {session.isCurrent && (
              <Badge
                variant="outline"
                className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                Bu cihaz
              </Badge>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> {session.ipAddress ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {new Date(session.lastActiveAt).toLocaleString()}
            </span>
          </div>
        </div>
        {!session.isCurrent && onRevoke && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRevoke(session.id)}
          >
            Logout
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
