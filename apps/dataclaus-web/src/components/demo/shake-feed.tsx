'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtime, type ScoreCalculatedEvent } from '@/lib/realtime';

interface FeedRow extends ScoreCalculatedEvent {
  receivedAt: number;
}

const MAX_ROWS = 12;

function shortId(value: string | undefined | null): string {
  if (!value) return '—';
  return value.length > 8 ? value.slice(0, 8) : value;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function qualityClass(score: number): string {
  if (score >= 0.7) return 'text-emerald-600';
  if (score >= 0.4) return 'text-amber-600';
  return 'text-rose-600';
}

export function ShakeFeed() {
  const { on } = useRealtime();
  const [rows, setRows] = useState<FeedRow[]>([]);

  useEffect(() => {
    const off = on<ScoreCalculatedEvent>('event:scored', (event) => {
      setRows((prev) => {
        const next: FeedRow = { ...event, receivedAt: Date.now() };
        return [next, ...prev].slice(0, MAX_ROWS);
      });
    });
    return () => {
      off();
    };
  }, [on]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Live Event Feed</p>
          <p className="text-xs text-slate-500">
            Streaming directly from the ingest pipeline.
          </p>
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            Waiting for events… Shake a paired phone or run the demo seeder.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white/95 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">App</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Quality</th>
                <th className="px-4 py-2 text-right font-medium">Payout</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((row) => (
                  <motion.tr
                    key={row.eventId}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="border-t border-slate-50 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2 font-mono text-slate-500">
                      {formatTime(row.receivedAt)}
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-700">
                      {shortId(row.userId)}
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-700">
                      {shortId(row.applicationId)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.eventType ?? '—'}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-semibold ${qualityClass(
                        Number(row.qualityScore ?? 0),
                      )}`}
                    >
                      {(Number(row.qualityScore ?? 0) * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">
                      ${Number(row.payoutAmount ?? 0).toFixed(4)}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
