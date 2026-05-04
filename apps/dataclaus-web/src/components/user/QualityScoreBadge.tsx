'use client';

import { Badge } from '@/components/ui/badge';
import { Star } from 'phosphor-react';

interface Props {
  score: number;
  size?: 'sm' | 'md';
}

function classify(score: number): { label: string; tone: string } {
  if (score >= 0.85) {
    return {
      label: 'Excellent',
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (score >= 0.65) {
    return { label: 'Good', tone: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  if (score >= 0.4) {
    return {
      label: 'Improving',
      tone: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return { label: 'Low', tone: 'bg-rose-50 text-rose-700 border-rose-200' };
}

export function QualityScoreBadge({ score, size = 'md' }: Props) {
  const safe = Number.isFinite(score) ? score : 0;
  const { label, tone } = classify(safe);
  return (
    <Badge
      variant="outline"
      className={`${tone} flex items-center gap-1 ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
      }`}
    >
      <Star size={size === 'sm' ? 10 : 12} weight="fill" />
      {label} · {(safe * 100).toFixed(0)}/100
    </Badge>
  );
}
