'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRealtime, type ScoreCalculatedEvent } from '@/lib/realtime';

interface BucketPoint {
  ts: number;
  label: string;
  events: number;
  payout: number;
}

const WINDOW_SECONDS = 60;

function emptyBuckets(now: number): BucketPoint[] {
  return Array.from({ length: WINDOW_SECONDS }, (_, i) => {
    const ts = now - (WINDOW_SECONDS - 1 - i) * 1000;
    return {
      ts,
      label: secondLabel(ts),
      events: 0,
      payout: 0,
    };
  });
}

function secondLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function LiveChart() {
  const { on } = useRealtime();
  const bucketsRef = useRef<BucketPoint[]>(emptyBuckets(Date.now()));
  const [data, setData] = useState<BucketPoint[]>(bucketsRef.current);

  // Tick once per second: shift the window forward, drop the oldest bucket.
  useEffect(() => {
    const tick = window.setInterval(() => {
      const now = Date.now();
      const lastTs = bucketsRef.current[bucketsRef.current.length - 1]?.ts ?? now;
      const elapsed = Math.max(1, Math.round((now - lastTs) / 1000));
      const next = bucketsRef.current.slice();

      for (let i = 0; i < elapsed; i++) {
        next.shift();
        const ts = lastTs + (i + 1) * 1000;
        next.push({ ts, label: secondLabel(ts), events: 0, payout: 0 });
      }

      bucketsRef.current = next;
      setData(next);
    }, 1000);

    return () => window.clearInterval(tick);
  }, []);

  // Append incoming events into the current bucket.
  useEffect(() => {
    const off = on<ScoreCalculatedEvent>('event:scored', (event) => {
      const buckets = bucketsRef.current;
      const last = buckets[buckets.length - 1];
      if (!last) return;
      last.events += 1;
      last.payout += Number(event.payoutAmount ?? 0);
      // Force a render — mutating ref does not, so produce a shallow copy.
      bucketsRef.current = [...buckets.slice(0, -1), { ...last }];
      setData(bucketsRef.current);
    });
    return () => {
      off();
    };
  }, [on]);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="liveEvents" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={9}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontSize: 12,
            }}
            formatter={(value: number, name: string) =>
              name === 'payout'
                ? [`$${value.toFixed(4)}`, 'Payout']
                : [`${value}`, 'Events']
            }
            labelFormatter={(label) => `T-${label}`}
          />
          <Area
            type="monotone"
            dataKey="events"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#liveEvents)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
