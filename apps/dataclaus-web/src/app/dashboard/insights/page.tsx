'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useMyPackages } from '@/lib/api-hooks';
import { RequireRole } from '@/lib/route-guards';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataclausScoreGauge } from '@/components/packages/score-gauge';
import { ErrorPanel } from '@/components/layout/error-panel';
import {
  ArrowRight,
  ChartBar,
  Warning,
  CheckCircle,
  Sparkle,
  Users,
  Tag,
  ArrowUpRight,
} from 'phosphor-react';
import type { DataPackage } from '@/lib/api';

const RUBRIC_LABELS: Record<string, string> = {
  schema_integrity: 'Schema Integrity',
  sample_diversity: 'Sample Diversity',
  bot_signature_absence: 'Bot Absence',
  claim_evidence_alignment: 'Claim Alignment',
  price_fairness: 'Price Fairness',
};

const IMPROVE_TIPS: Record<string, string> = {
  schema_integrity:
    'Define field types precisely and keep column names consistent across rows.',
  sample_diversity:
    'Include rows from different time windows, user segments, and behavioral patterns.',
  bot_signature_absence:
    'Ensure organic activity — repeated identical timestamps lower this score.',
  claim_evidence_alignment:
    'Your claimed row count must closely match the sample data provided.',
  price_fairness:
    'Benchmark against similar certified packages. Overpriced datasets are flagged.',
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function statusVariant(status: DataPackage['status']) {
  switch (status) {
    case 'certified':
    case 'sold':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'evaluating':
    case 'pending':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'rejected':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function RubricBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-36 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono font-medium text-slate-700 w-8 text-right">{pct}%</span>
    </div>
  );
}

function InsightsContent() {
  const { data: packages = [], isLoading, isError, error, refetch } = useMyPackages();

  const stats = useMemo(() => {
    const certified = packages.filter((p) => p.status === 'certified' || p.status === 'sold');
    const rejected = packages.filter((p) => p.status === 'rejected');
    const pending = packages.filter((p) => p.status === 'pending' || p.status === 'evaluating');
    const scored = packages.filter((p) => p.dataclausScore !== null);
    const avgScore =
      scored.length > 0
        ? scored.reduce((s, p) => s + (p.dataclausScore ?? 0), 0) / scored.length
        : null;

    const rubricTotals: Record<string, number> = {};
    let rubricCount = 0;
    for (const p of packages) {
      if (p.llmEvaluation?.rubric) {
        rubricCount++;
        for (const [k, v] of Object.entries(p.llmEvaluation.rubric)) {
          rubricTotals[k] = (rubricTotals[k] ?? 0) + v;
        }
      }
    }
    const avgRubric =
      rubricCount > 0
        ? Object.fromEntries(Object.entries(rubricTotals).map(([k, v]) => [k, v / rubricCount]))
        : null;

    const weakest =
      avgRubric
        ? Object.entries(avgRubric).sort(([, a], [, b]) => a - b)[0]?.[0] ?? null
        : null;

    const buyerTags: Record<string, number> = {};
    for (const p of packages) {
      for (const tag of p.llmEvaluation?.buyer_match ?? []) {
        buyerTags[tag] = (buyerTags[tag] ?? 0) + 1;
      }
    }
    const topBuyerTags = Object.entries(buyerTags)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    const allRedFlags = Array.from(
      new Set(packages.flatMap((p) => p.llmEvaluation?.red_flags ?? [])),
    ).slice(0, 4);

    const grade =
      avgScore === null
        ? null
        : avgScore >= 0.85
        ? 'A'
        : avgScore >= 0.70
        ? 'B'
        : avgScore >= 0.55
        ? 'C'
        : 'D';

    return { certified, rejected, pending, avgScore, avgRubric, weakest, topBuyerTags, allRedFlags, grade };
  }, [packages]);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <div className="h-52 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-72 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return <ErrorPanel error={error} reset={() => void refetch()} />;
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* Hero — dark split card */}
      <motion.div variants={item}>
        <Card className="border border-slate-200 shadow-lg bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="grid lg:grid-cols-5">
              {/* Dark left */}
              <div className="lg:col-span-2 bg-slate-900 text-white p-6 lg:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-800 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-slate-800 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs font-medium mb-4">
                    <ChartBar size={14} />
                    AI Intelligence Report
                  </div>
                  <h2 className="text-2xl font-bold mb-1">Package Portfolio</h2>
                  <p className="text-slate-400 text-sm mb-6">
                    DataClaus AI evaluation across all your submitted datasets.
                  </p>
                  {packages.length === 0 ? (
                    <p className="text-slate-500 text-sm">No packages yet.</p>
                  ) : (
                    <div className="flex items-end gap-4">
                      <div>
                        <p className="text-5xl font-bold leading-none">
                          {stats.avgScore !== null
                            ? `${(stats.avgScore * 100).toFixed(0)}%`
                            : '—'}
                        </p>
                        <p className="text-slate-400 text-xs mt-1">Average DataClaus Score</p>
                      </div>
                      {stats.grade && (
                        <div className="mb-1">
                          <span className="text-3xl font-bold text-slate-400">
                            Grade {stats.grade}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {packages.length > 0 && (
                    <div className="flex gap-4 mt-5 pt-5 border-t border-slate-800">
                      <div>
                        <p className="text-lg font-bold text-emerald-400">{stats.certified.length}</p>
                        <p className="text-xs text-slate-500">Certified</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-400">{stats.rejected.length}</p>
                        <p className="text-xs text-slate-500">Rejected</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-400">{stats.pending.length}</p>
                        <p className="text-xs text-slate-500">Pending</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{packages.length}</p>
                        <p className="text-xs text-slate-500">Total</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right — rubric overview */}
              <div className="lg:col-span-3 p-6 lg:p-8">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-widest">
                    Portfolio Rubric Average
                  </h4>
                  <Link href="/dashboard/packages/new">
                    <span className="inline-flex items-center text-xs font-semibold text-slate-900 px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-900 hover:text-white transition-colors">
                      New Package <ArrowRight size={12} className="ml-1.5" />
                    </span>
                  </Link>
                </div>

                {packages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <ChartBar size={24} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600">No evaluation data yet</p>
                    <p className="text-xs text-slate-400 mt-1">Submit a data package to see your AI scores here.</p>
                    <Link href="/dashboard/packages/new" className="mt-4">
                      <span className="inline-flex items-center text-xs font-semibold text-white px-4 py-2 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors">
                        Submit first package <ArrowRight size={12} className="ml-1.5" />
                      </span>
                    </Link>
                  </div>
                ) : stats.avgRubric ? (
                  <div className="space-y-4">
                    {Object.entries(stats.avgRubric).map(([k, v]) => (
                      <RubricBar key={k} label={RUBRIC_LABELS[k] ?? k} value={v} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Evaluation pending…</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Improvement focus */}
        {stats.weakest && (
          <motion.div variants={item}>
            <Card className="border border-amber-200 bg-amber-50 shadow-sm h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-amber-900">
                    Focus Area
                  </h4>
                  <Warning size={16} className="text-amber-500" weight="fill" />
                </div>
                <p className="text-base font-bold text-amber-900 mb-2">
                  {RUBRIC_LABELS[stats.weakest] ?? stats.weakest}
                </p>
                <p className="text-sm text-amber-700 leading-relaxed">
                  {IMPROVE_TIPS[stats.weakest] ??
                    'Improve this dimension to raise your overall DataClaus score.'}
                </p>
                {stats.avgRubric && stats.weakest && (
                  <div className="mt-4 pt-4 border-t border-amber-200">
                    <div className="flex items-center justify-between text-xs text-amber-700">
                      <span>Current score</span>
                      <span className="font-bold text-lg text-amber-900">
                        {((stats.avgRubric[stats.weakest] ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Buyer demand */}
        {stats.topBuyerTags.length > 0 && (
          <motion.div variants={item}>
            <Card className="glass-panel border-0 shadow-md h-full">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Buyer Demand
                  </h4>
                  <Tag size={16} className="text-slate-400" weight="duotone" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats.topBuyerTags.map(([tag, count]) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700 capitalize"
                    >
                      {tag}
                      <span className="text-slate-400">×{count}</span>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-4">
                  Buyer verticals interested in your data categories based on AI evaluation.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Red flags */}
      {stats.allRedFlags.length > 0 && (
        <motion.div variants={item}>
          <Card className="glass-panel border-0 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  AI Red Flags
                </h4>
                <Warning size={16} className="text-red-400" weight="fill" />
              </div>
              <div className="space-y-3">
                {stats.allRedFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-red-500 text-xs font-bold">!</span>
                    </div>
                    <p className="text-sm text-slate-700">{flag}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-4">
                Address these in your next submission to improve certification odds.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Package list */}
      {packages.length > 0 && (
        <motion.div variants={item}>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Package Breakdown
          </h4>
          <div className="space-y-3">
            {packages.map((pkg, index) => (
              <Link key={pkg.id} href={`/dashboard/packages/${pkg.id}`} className="block group">
                <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-900 hover:shadow-md transition-all duration-200">
                  {/* Index */}
                  <div className="shrink-0 h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>

                  {/* Score gauge */}
                  <DataclausScoreGauge value={pkg.dataclausScore} size="sm" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">
                        {pkg.title}
                      </p>
                      <Badge variant="outline" className={`${statusVariant(pkg.status)} text-xs shrink-0`}>
                        {pkg.status}
                      </Badge>
                    </div>
                    {pkg.llmEvaluation ? (
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {pkg.llmEvaluation.summary}
                      </p>
                    ) : (
                      <p className="text-xs text-blue-500 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                        Evaluation in progress…
                      </p>
                    )}

                    {/* Bottom rubric pills — 2 weakest */}
                    {pkg.llmEvaluation?.rubric && (
                      <div className="flex gap-3 mt-1.5">
                        {Object.entries(pkg.llmEvaluation.rubric)
                          .sort(([, a], [, b]) => a - b)
                          .slice(0, 2)
                          .map(([k, v]) => {
                            const pct = Math.round(v * 100);
                            const color =
                              pct >= 80
                                ? 'text-emerald-600'
                                : pct >= 60
                                ? 'text-amber-500'
                                : 'text-red-500';
                            return (
                              <span key={k} className="text-xs text-slate-400">
                                {RUBRIC_LABELS[k]?.split(' ')[0]}:{' '}
                                <span className={`font-semibold ${color}`}>{pct}%</span>
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Price + arrow */}
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-slate-900">${pkg.price.toFixed(2)}</p>
                    <p className="text-xs text-slate-400">{pkg.category}</p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-slate-300 group-hover:text-slate-900 transition-colors shrink-0"
                  />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function InsightsPage() {
  return (
    <RequireRole role={['developer', 'admin']}>
      <InsightsContent />
    </RequireRole>
  );
}
