'use client';

import { ErrorPanel } from '@/components/layout/error-panel';

export default function AdminError({
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
      title="Admin panel error"
      description="This view crashed. The fix is usually a backend or data issue — share the reference below with engineering."
      variant="dark"
    />
  );
}
