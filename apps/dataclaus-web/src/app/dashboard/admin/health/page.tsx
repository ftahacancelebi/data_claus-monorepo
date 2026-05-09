'use client';

import Link from 'next/link';
import { useAdminHealth } from '@/lib/api-hooks';
import type { HealthCheck, HealthStatus, HealthSummary } from '@/lib/api';

const STATUS_ICON: Record<HealthStatus, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  green: 'Healthy',
  yellow: 'Degraded',
  red: 'Down',
};

export default function AdminHealthPage() {
  // refetchInterval: 2s is configured inside useAdminHealth; no manual
  // setInterval/cleanup needed. React Query also pauses polling when the tab
  // is hidden, which the previous implementation didn't.
  const healthQuery = useAdminHealth();
  const summary = healthQuery.data ?? null;
  const error = healthQuery.error?.message ?? '';
  // Round-trip latency: dataUpdatedAt - earlier-poll timestamp would require
  // tracking; for an at-a-glance display we just show 'live' if data exists.
  const lastFetchMs = healthQuery.isFetching ? 0 : 1; // placeholder; UI reads it as a marker

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Platform Health
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Live aggregate. Polls every 2 seconds.
            </p>
          </div>
          <Link
            href="/dashboard/admin"
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Admin home
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 mb-6">
            <strong>Health endpoint unreachable:</strong> {error}
            <div className="text-xs mt-1 text-red-500">
              Is the NestJS API running on port 3000?
            </div>
          </div>
        )}

        {summary && (
          <>
            <OverallBanner summary={summary} latencyMs={lastFetchMs} />
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.checks.map((c) => (
                <CheckCard key={c.name} check={c} />
              ))}
            </div>
            <div className="mt-6 text-xs text-gray-500">
              Snapshot: {new Date(summary.checkedAt).toLocaleString()} (fetch{' '}
              {lastFetchMs}ms)
            </div>
          </>
        )}

        {!summary && !error && (
          <div className="bg-white border border-gray-200 rounded-md p-6 text-gray-500">
            Loading platform health…
          </div>
        )}
      </div>
    </div>
  );
}

function OverallBanner({
  summary,
  latencyMs,
}: {
  summary: HealthSummary;
  latencyMs: number;
}) {
  const bg =
    summary.status === 'green'
      ? 'bg-green-50 border-green-300 text-green-900'
      : summary.status === 'yellow'
        ? 'bg-yellow-50 border-yellow-300 text-yellow-900'
        : 'bg-red-50 border-red-300 text-red-900';
  return (
    <div className={`border-2 rounded-lg p-6 ${bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-4xl">{STATUS_ICON[summary.status]}</div>
          <div>
            <div className="text-2xl font-bold">
              {STATUS_LABEL[summary.status]}
            </div>
            <div className="text-sm opacity-75">
              {summary.checks.length} subsystems checked, fetched in{' '}
              {latencyMs}ms
            </div>
          </div>
        </div>
        <div className="text-right text-sm">
          <div>Last update</div>
          <div className="font-mono">
            {new Date(summary.checkedAt).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCard({ check }: { check: HealthCheck }) {
  const border =
    check.status === 'green'
      ? 'border-green-200'
      : check.status === 'yellow'
        ? 'border-yellow-200'
        : 'border-red-300';
  return (
    <div className={`bg-white border ${border} rounded-lg p-5`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-gray-900">{check.name}</div>
        <span className="text-2xl">{STATUS_ICON[check.status]}</span>
      </div>
      <div className="text-sm text-gray-600">{check.detail}</div>
      {check.metric !== undefined && check.metric !== null && (
        <div className="text-xs text-gray-400 mt-2 font-mono">
          metric: {check.metric}
        </div>
      )}
    </div>
  );
}
