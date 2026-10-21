'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-6 text-center">
        <div className="mx-auto w-10 h-10 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] flex items-center justify-center mb-4">
          <AlertTriangle size={18} />
        </div>
        <h1 className="text-base font-semibold text-[var(--color-text)]">Something went wrong</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">
          This page could not be displayed. You can retry, or return to your dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--color-muted-fg)] mt-2 font-mono">Reference: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/crm/dashboard"
            className="px-4 py-2 text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
