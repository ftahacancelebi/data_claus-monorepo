/**
 * Shared loading skeleton variants for `loading.tsx` route-segment files.
 *
 * Why segment-specific: a single generic spinner causes layout shift when
 * the real content lands. These skeletons match the rough shape of each
 * segment's content (header + cards + table) so the user feels the page
 * "filling in" rather than jumping.
 *
 * Server Component compatible (no hooks, no client APIs).
 */

interface SegmentSkeletonProps {
  variant?: 'dashboard' | 'user-portal' | 'admin' | 'centered';
  label?: string;
}

export function SegmentSkeleton({
  variant = 'dashboard',
  label,
}: SegmentSkeletonProps) {
  if (variant === 'centered') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          {label ? (
            <p className="text-sm text-slate-500 font-medium">{label}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const isDark = variant === 'admin';
  const cardBase = isDark
    ? 'bg-white/5 border border-white/10'
    : 'bg-white border border-slate-100';
  const pulse = isDark ? 'bg-white/5' : 'bg-slate-100';

  return (
    <div className="space-y-6 p-2 md:p-0">
      {/* Header */}
      <div className="space-y-2">
        <div className={`h-7 w-48 rounded ${pulse} animate-pulse`} />
        <div className={`h-4 w-72 rounded ${pulse} animate-pulse opacity-70`} />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`rounded-2xl ${cardBase} p-5 space-y-3 animate-pulse`}
          >
            <div className={`h-4 w-20 rounded ${pulse}`} />
            <div className={`h-8 w-32 rounded ${pulse}`} />
            <div className={`h-3 w-24 rounded ${pulse} opacity-70`} />
          </div>
        ))}
      </div>

      {/* Wide content row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`lg:col-span-2 rounded-2xl ${cardBase} p-6 animate-pulse`}>
          <div className={`h-5 w-40 rounded ${pulse} mb-4`} />
          <div className={`h-56 rounded ${pulse} opacity-70`} />
        </div>
        <div className={`rounded-2xl ${cardBase} p-6 animate-pulse`}>
          <div className={`h-5 w-32 rounded ${pulse} mb-4`} />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-4 rounded ${pulse}`} style={{ width: `${100 - i * 10}%` }} />
            ))}
          </div>
        </div>
      </div>

      {/* Table-ish list */}
      <div className={`rounded-2xl ${cardBase} p-6 animate-pulse`}>
        <div className={`h-5 w-44 rounded ${pulse} mb-4`} />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-12 rounded-xl ${pulse}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
