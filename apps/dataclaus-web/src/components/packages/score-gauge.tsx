'use client';

import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';

interface DataclausScoreGaugeProps {
  /** 0–1 score from `dataclausScore`. Pass `null` for "not yet evaluated". */
  value: number | null;
  size?: Size;
  /** Override the "DataClaus Trust Score" label. */
  label?: string;
  className?: string;
}

const dims: Record<Size, { wrap: number; stroke: number; text: string; sub: string }> = {
  sm: { wrap: 64, stroke: 6, text: 'text-base font-bold', sub: 'text-[10px]' },
  md: { wrap: 96, stroke: 8, text: 'text-xl font-bold', sub: 'text-xs' },
  lg: { wrap: 140, stroke: 10, text: 'text-3xl font-bold', sub: 'text-xs' },
};

function colorFor(v: number | null): { ring: string; text: string; label: string } {
  if (v == null) {
    return { ring: 'stroke-slate-300', text: 'text-slate-400', label: 'Pending' };
  }
  if (v >= 0.85) return { ring: 'stroke-emerald-500', text: 'text-emerald-600', label: 'Excellent' };
  if (v >= 0.65) return { ring: 'stroke-amber-500', text: 'text-amber-600', label: 'Good' };
  return { ring: 'stroke-red-500', text: 'text-red-600', label: 'Weak' };
}

/**
 * Circular trust-score gauge used across the marketplace.
 *
 * The arc length is linear in `value`. Color band:
 *   ≥0.85 emerald, 0.65–0.85 amber, <0.65 red. `null` → grey ring + "Pending".
 *
 * The gauge fills with a 300 ms CSS transition the first time the value lands,
 * which makes the demo flip from "Evaluating…" to a real score feel intentional.
 */
export function DataclausScoreGauge({
  value,
  size = 'md',
  label,
  className,
}: DataclausScoreGaugeProps) {
  const { wrap, stroke, text, sub } = dims[size];
  const radius = (wrap - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value));
  const offset = circumference * (1 - pct);
  const { ring, text: colorText, label: severity } = colorFor(value);

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className="relative" style={{ width: wrap, height: wrap }}>
        <svg width={wrap} height={wrap} className="-rotate-90 transform">
          <circle
            cx={wrap / 2}
            cy={wrap / 2}
            r={radius}
            strokeWidth={stroke}
            className="stroke-slate-100"
            fill="transparent"
          />
          <circle
            cx={wrap / 2}
            cy={wrap / 2}
            r={radius}
            strokeWidth={stroke}
            className={cn(ring, 'transition-[stroke-dashoffset] duration-500 ease-out')}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn(text, colorText)}>
            {value == null ? '—' : value.toFixed(2)}
          </span>
          <span className={cn(sub, 'uppercase tracking-wider text-slate-400')}>
            {severity}
          </span>
        </div>
      </div>
      {label && (
        <p className={cn('mt-2 font-medium text-slate-500', sub)}>{label}</p>
      )}
    </div>
  );
}
