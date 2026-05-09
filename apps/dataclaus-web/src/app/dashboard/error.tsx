'use client';

import { ErrorPanel } from '@/components/layout/error-panel';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPanel
      error={error}
      reset={reset}
      title="Dashboard hit an error"
      description="A panel on this page failed to render. Reload the page or jump back to a working area."
    />
  );
}
