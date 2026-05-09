'use client';

import { ErrorPanel } from '@/components/layout/error-panel';

export default function UserPortalError({
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
      title="Your earnings dashboard hit an error"
      description="We couldn't render this section. Try again or refresh — your data is safe."
    />
  );
}
