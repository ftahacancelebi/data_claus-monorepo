'use client';

import { useEffect, useState } from 'react';
import { useRealtime, type ScoreCalculatedEvent } from '@/lib/realtime';
import { cn } from '@/lib/utils';

interface RealtimeStatusBadgeProps {
  className?: string;
  /** Optional label override. */
  label?: string;
}

export function RealtimeStatusBadge({
  className,
  label,
}: RealtimeStatusBadgeProps) {
  const { status, on } = useRealtime();
  const [eventsPerSec, setEventsPerSec] = useState(0);

  // Sliding window: keep timestamps of the last events and refresh once a second.
  useEffect(() => {
    const timestamps: number[] = [];

    const off = on<ScoreCalculatedEvent>('event:scored', () => {
      timestamps.push(Date.now());
    });

    const interval = window.setInterval(() => {
      const cutoff = Date.now() - 1000;
      while (timestamps.length && timestamps[0] < cutoff) {
        timestamps.shift();
      }
      setEventsPerSec(timestamps.length);
    }, 1000);

    return () => {
      off();
      window.clearInterval(interval);
    };
  }, [on]);

  const isLive = status === 'connected';
  const dotColor = isLive
    ? 'bg-emerald-500'
    : status === 'connecting'
      ? 'bg-amber-500'
      : 'bg-slate-300';
  const text = label ?? (isLive ? 'Live' : status === 'connecting' ? 'Connecting' : 'Offline');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur',
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {isLive && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', dotColor)} />
      </span>
      <span>{text}</span>
      {isLive && eventsPerSec > 0 && (
        <span className="text-slate-500">· {eventsPerSec}/s</span>
      )}
    </span>
  );
}
