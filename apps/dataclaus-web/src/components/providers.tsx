'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

/**
 * Top-level client providers. Wraps the app in a single QueryClient instance
 * per browser session.
 *
 * The `useState` initializer pattern guarantees that:
 *   - QueryClient is created exactly once per mount (no recreate on re-render)
 *   - Each browser tab gets its own client (no cross-tab cache pollution)
 *
 * Defaults are tuned for a dashboard app:
 *   - staleTime 30s: data is considered fresh for 30s, no refetch on focus
 *     within that window. Prevents the "click between tabs and watch every
 *     panel reload" UX.
 *   - retry once: surface real errors quickly instead of pretending the API
 *     might come back to life on the third try.
 *   - refetchOnWindowFocus: true (default). When the user returns to the tab,
 *     stale queries refetch. Essential for an earnings dashboard that updates
 *     in real time.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  );
}
