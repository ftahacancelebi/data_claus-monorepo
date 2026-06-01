'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useMyPackages, useMyContributionStats } from '@/lib/api-hooks';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/badge';
import { DataclausScoreGauge } from '@/components/packages/score-gauge';
import { ErrorPanel } from '@/components/layout/error-panel';
import {
  ArrowRight,
  ChartBar,
  Warning,
  Sparkle,
  Tag,
  Eye,
  Database,
  TrendUp,
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
    pct >= 80 ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : pct >= 60 ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
        <span className="text-sm font-black tracking-tight text-slate-900">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function ContributionSection() {
  const { data: stats, isLoading } = useMyContributionStats();

  if (isLoading) {
    return (
      <div className="h-56 bg-slate-100 rounded-2xl animate-pulse" />
    );
  }

  const hasData = stats && stats.totalEvents > 0;

  return (
    <motion.div variants={item}>
      <div className="relative w-full overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-dashed divide-slate-300">
          {/* Left: headline stats */}
          <div className="lg:col-span-2 p-8 lg:p-10 relative overflow-hidden group flex flex-col justify-between min-h-[280px]">
            <div className="absolute -bottom-10 -right-10 opacity-[0.03] group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none text-slate-900">
              <Database size={240} weight="duotone" />
            </div>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 text-slate-700 text-[10px] font-bold tracking-widest uppercase mb-6 border border-slate-200 shadow-sm">
                <Eye size={14} weight="bold" /> Behavior Data
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2 leading-none">Contributions</h2>
              <p className="text-slate-500 text-sm mb-6 max-w-sm">
                Data you've generated through the platform — anonymized and aggregated.
              </p>
            </div>

            <div className="relative z-10 mt-auto">
              {!hasData ? (
                <p className="text-slate-500 text-sm font-medium">No watch activity yet.</p>
              ) : (
                <>
                  <div className="flex items-end gap-4 mb-6">
                    <div>
                      <p className="text-[56px] font-black tracking-tighter text-slate-900 leading-none">
                        {stats.totalEvents.toLocaleString()}
                      </p>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Watch Events</p>
                    </div>
                    {stats.poolContributionPct > 0 && (
                      <div className="mb-1">
                        <span className="text-2xl font-black text-emerald-400 tracking-tighter">
                          {stats.poolContributionPct}%
                        </span>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">of pool</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-6 pt-6 border-t border-dashed border-slate-200">
                    <div>
                      <p className="text-2xl font-black text-emerald-500">{stats.completedEvents.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-slate-400">{stats.partialEvents.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Partial</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black text-blue-500">${stats.totalEarnedFromData.toFixed(4)}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Earnings</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: category & tag breakdown */}
          <div className="lg:col-span-3 p-8 lg:p-10 relative overflow-hidden group">
            <div className="absolute -bottom-16 -right-16 opacity-[0.02] group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none text-slate-900">
              <TrendUp size={320} weight="duotone" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  Category Breakdown
                </h4>
                <span className="text-[10px] font-bold text-slate-400 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl">
                  Anonymous
                </span>
              </div>

              {!hasData ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 shadow-sm">
                    <Eye size={28} weight="duotone" className="text-slate-400" />
                  </div>
                  <p className="text-base font-bold text-slate-700">No watch data yet</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">Watch videos in the app to generate behavior data.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {stats.topCategories.length > 0 ? (
                    <>
                      {stats.topCategories.map(({ category, count }) => {
                        const max = stats.topCategories[0]?.count ?? 1;
                        const pct = Math.round((count / max) * 100);
                        return (
                          <div key={category} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 capitalize">{category}</span>
                              <span className="text-sm font-black tracking-tight text-slate-900">{count}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                              <motion.div
                                className="h-full rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {stats.topTags.length > 0 && (
                        <div className="pt-4 border-t border-dashed border-slate-200">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Top Tags</p>
                          <div className="flex flex-wrap gap-2">
                            {stats.topTags.slice(0, 8).map(({ tag, count }) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white shadow-sm text-[10px] font-bold text-slate-600 capitalize"
                              >
                                {tag}
                                <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1 py-0.5 rounded">×{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm font-medium text-slate-500">No category data yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InsightsContent() {
  const { user } = useAuth();
  const isDeveloper = user?.role === 'developer' || user?.role === 'admin';
  const { data: packages = [], isLoading, isError, error, refetch } = useMyPackages({ enabled: isDeveloper });

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
      {/* Behavior Data Contributions */}
      <ContributionSection />

      {/* Package portfolio — developer/admin only */}
      {isDeveloper && (<>
      <motion.div variants={item}>
        <div className="relative w-full overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-dashed divide-slate-300">
            {/* Left part: Stats */}
            <div className="lg:col-span-2 p-8 lg:p-10 relative overflow-hidden group flex flex-col justify-between min-h-[320px]">
              <div className="absolute -bottom-10 -right-10 opacity-[0.03] group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none text-slate-900">
                <Sparkle size={240} weight="duotone" />
              </div>
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 text-slate-700 text-[10px] font-bold tracking-widest uppercase mb-6 border border-slate-200 shadow-sm">
                  <ChartBar size={14} weight="bold" /> AI Intelligence Report
                </div>
                <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2 leading-none">Package Portfolio</h2>
                <p className="text-slate-500 text-sm mb-6 max-w-sm">
                  DataClaus AI evaluation across all your submitted datasets.
                </p>
              </div>

              <div className="relative z-10 mt-auto">
                {packages.length === 0 ? (
                  <p className="text-slate-500 text-sm font-medium">No packages yet.</p>
                ) : (
                  <>
                    <div className="flex items-end gap-4 mb-6">
                      <div>
                        <p className="text-[56px] font-black tracking-tighter text-slate-900 leading-none">
                          {stats.avgScore !== null
                            ? `${(stats.avgScore * 100).toFixed(0)}%`
                            : '—'}
                        </p>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Avg DataClaus Score</p>
                      </div>
                      {stats.grade && (
                        <div className="mb-1">
                          <span className="text-4xl font-black text-slate-300 tracking-tighter">
                            {stats.grade}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-6 pt-6 border-t border-dashed border-slate-200">
                      <div>
                        <p className="text-2xl font-black text-emerald-500">{stats.certified.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Certified</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-rose-500">{stats.rejected.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rejected</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-blue-500">{stats.pending.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-slate-900">{packages.length}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right part: Rubric */}
            <div className="lg:col-span-3 p-8 lg:p-10 relative overflow-hidden group">
              <div className="absolute -bottom-16 -right-16 opacity-[0.02] group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none text-slate-900">
                <ChartBar size={320} weight="duotone" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    Portfolio Rubric Average
                  </h4>
                  <Link href="/dashboard/packages/new">
                    <span className="inline-flex items-center text-xs font-bold text-slate-700 px-4 py-2 bg-slate-50 border border-slate-200 shadow-sm rounded-xl hover:bg-slate-100 transition-colors">
                      New Package <ArrowRight size={14} weight="bold" className="ml-1.5" />
                    </span>
                  </Link>
                </div>

                {packages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-16 w-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 shadow-sm">
                      <ChartBar size={28} weight="duotone" className="text-slate-400" />
                    </div>
                    <p className="text-base font-bold text-slate-700">No evaluation data yet</p>
                    <p className="text-sm font-medium text-slate-500 mt-1 mb-6">Submit a data package to see your AI scores here.</p>
                    <Link href="/dashboard/packages/new">
                      <span className="inline-flex items-center text-sm font-bold text-white px-5 py-2.5 bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors shadow-sm">
                        Submit first package <ArrowRight size={16} weight="bold" className="ml-1.5" />
                      </span>
                    </Link>
                  </div>
                ) : stats.avgRubric ? (
                  <div className="space-y-6">
                    {Object.entries(stats.avgRubric).map(([k, v]) => (
                      <RubricBar key={k} label={RUBRIC_LABELS[k] ?? k} value={v} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-500">Evaluation pending…</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-8 mt-8">
        {/* Improvement focus */}
        {stats.weakest && (
          <motion.div variants={item}>
            <div className="relative h-full overflow-hidden bg-amber-50/50 backdrop-blur-xl border border-amber-200/80 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] group flex flex-col justify-between min-h-[240px]">
              <div className="absolute -bottom-6 -right-6 opacity-[0.05] group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-700 pointer-events-none text-amber-900">
                <Warning size={160} weight="duotone" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-amber-800/70">
                    Focus Area
                  </h4>
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Warning size={16} className="text-amber-600" weight="bold" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold tracking-tight text-amber-900 mb-3 leading-tight">
                  {RUBRIC_LABELS[stats.weakest] ?? stats.weakest}
                </p>
                <p className="text-sm font-medium text-amber-800/80 leading-relaxed max-w-[90%]">
                  {IMPROVE_TIPS[stats.weakest] ??
                    'Improve this dimension to raise your overall DataClaus score.'}
                </p>
              </div>
              {stats.avgRubric && stats.weakest && (
                <div className="relative z-10 mt-auto pt-6 border-t border-dashed border-amber-200/60 flex items-end justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-amber-800/60">Current score</span>
                  <span className="font-black text-3xl text-amber-900 leading-none">
                    {((stats.avgRubric[stats.weakest] ?? 0) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Buyer demand */}
        {stats.topBuyerTags.length > 0 && (
          <motion.div variants={item}>
            <div className="relative h-full overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] group flex flex-col min-h-[240px]">
              <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none text-slate-900">
                <Tag size={160} weight="duotone" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Buyer Demand
                  </h4>
                  <div className="h-8 w-8 rounded-full bg-slate-50 border border-slate-100 shadow-sm flex items-center justify-center">
                    <Tag size={16} className="text-slate-500" weight="bold" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5 mb-6">
                  {stats.topBuyerTags.map(([tag, count]) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white shadow-sm text-xs font-bold text-slate-700 capitalize"
                    >
                      {tag}
                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">×{count}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative z-10 mt-auto pt-6 border-t border-dashed border-slate-200">
                <p className="text-xs font-medium text-slate-500 leading-relaxed">
                  Buyer verticals interested in your data categories based on AI evaluation.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Red flags */}
      {stats.allRedFlags.length > 0 && (
        <motion.div variants={item}>
          <div className="relative overflow-hidden bg-rose-50/50 backdrop-blur-xl border border-rose-200/80 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] group mt-8">
            <div className="absolute -bottom-10 -right-10 opacity-[0.03] group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none text-rose-900">
              <Warning size={200} weight="duotone" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-rose-800/70">
                  AI Red Flags
                </h4>
                <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center">
                  <Warning size={16} className="text-rose-600" weight="bold" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {stats.allRedFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-white/60 border border-rose-100 rounded-2xl shadow-sm">
                    <div className="h-6 w-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                      <span className="text-rose-600 text-xs font-black">!</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 mt-0.5 leading-snug">{flag}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-rose-800/60 mt-6 pt-5 border-t border-dashed border-rose-200/60">
                Address these in your next submission to improve certification odds.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Package list */}
      {packages.length > 0 && (
        <motion.div variants={item} className="mt-8">

          <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4 pl-2">
            Package Breakdown
          </h4>
          <div className="space-y-4">
            {packages.map((pkg, index) => (
              <Link key={pkg.id} href={`/dashboard/packages/${pkg.id}`} className="block group outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-3xl">
                <div className="relative overflow-hidden flex items-center gap-5 p-6 rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:border-slate-300 transition-all duration-300">
                  {/* Background Watermark for rows */}
                  <div className="absolute -right-6 opacity-[0.02] group-hover:opacity-[0.04] group-hover:scale-110 transition-all duration-700 pointer-events-none text-slate-900">
                    <ChartBar size={120} weight="duotone" />
                  </div>

                  {/* Index */}
                  <div className="shrink-0 h-10 w-10 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center text-sm font-black shadow-sm">
                    {index + 1}
                  </div>

                  {/* Score gauge */}
                  <div className="shrink-0">
                    <DataclausScoreGauge value={pkg.dataclausScore} size="sm" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-base font-extrabold tracking-tight text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                        {pkg.title}
                      </p>
                      <Badge variant="outline" className={`${statusVariant(pkg.status)} text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 border-transparent shadow-sm shrink-0`}>
                        {pkg.status}
                      </Badge>
                    </div>
                    {pkg.llmEvaluation ? (
                      <p className="text-sm font-medium text-slate-500 line-clamp-1">
                        {pkg.llmEvaluation.summary}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-blue-500 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse inline-block shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                        Evaluation in progress…
                      </p>
                    )}

                    {/* Bottom rubric pills — 2 weakest */}
                    {pkg.llmEvaluation?.rubric && (
                      <div className="flex gap-3 mt-3">
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
                                : 'text-rose-500';
                            return (
                              <span key={k} className="inline-flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                {RUBRIC_LABELS[k]?.split(' ')[0]}:{' '}
                                <span className={`ml-1 font-black ${color}`}>{pct}%</span>
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Price + arrow */}
                  <div className="text-right shrink-0 relative z-10 flex items-center gap-6 border-l border-dashed border-slate-200 pl-6">
                    <div>
                      <p className="text-xl font-black tracking-tight text-slate-900">${pkg.price.toFixed(2)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{pkg.category}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <ArrowRight size={16} weight="bold" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}
      </>)}
    </motion.div>
  );
}

export default function InsightsPage() {
  return <InsightsContent />;
}
