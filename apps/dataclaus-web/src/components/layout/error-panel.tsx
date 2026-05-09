'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Shared error UI used by every `error.tsx` route segment.
 *
 * Accepts the same props Next.js passes to error boundaries:
 *   - `error`: the thrown Error (may have a `digest` for server-thrown ones)
 *   - `reset`: re-renders the segment from scratch (clears the boundary)
 *
 * Logs to console in dev so the trace is grep-able. In prod, hook this up
 * to your error reporter (Sentry/Bugsnag) by replacing the console.error.
 */
export function ErrorPanel({
  error,
  reset,
  title = 'Something went wrong',
  description,
  variant = 'default',
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  /** 'default' = light theme, 'dark' = matches admin segments */
  variant?: 'default' | 'dark';
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[error-boundary]', error);
  }, [error]);

  const isDark = variant === 'dark';

  return (
    <div
      className={
        isDark
          ? 'min-h-[60vh] flex items-center justify-center p-8'
          : 'min-h-[60vh] flex items-center justify-center bg-slate-50 p-8'
      }
    >
      <div
        className={`max-w-md w-full rounded-2xl border p-6 ${
          isDark
            ? 'border-red-500/20 bg-red-500/10 text-red-200'
            : 'border-red-100 bg-white shadow-sm'
        }`}
      >
        <h2
          className={`text-lg font-semibold mb-2 ${
            isDark ? 'text-red-200' : 'text-slate-900'
          }`}
        >
          {title}
        </h2>
        <p
          className={`text-sm mb-4 ${isDark ? 'text-red-200/80' : 'text-slate-600'}`}
        >
          {description ??
            'This page hit an unexpected error. You can try reloading or go back.'}
        </p>
        {error.message ? (
          <pre
            className={`text-xs overflow-x-auto rounded-md p-3 mb-4 ${
              isDark
                ? 'bg-black/30 text-red-100'
                : 'bg-slate-50 text-slate-700 border border-slate-100'
            }`}
          >
            {error.message}
          </pre>
        ) : null}
        {error.digest ? (
          <p
            className={`text-[11px] font-mono mb-4 ${
              isDark ? 'text-red-200/60' : 'text-slate-400'
            }`}
          >
            Reference: {error.digest}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button onClick={reset} size="sm">
            Try again
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
          >
            Go back
          </Button>
        </div>
      </div>
    </div>
  );
}
