'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { BrandName } from '@/components/brand/brand-name';

export default function CrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('CRM page error:', error.message, error.digest, error.stack)
  }, [error])

  return (
    <div>
      <div className="max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-8 h-8 shrink-0 rounded-md bg-[var(--color-warning-bg)] text-[var(--color-warning)] flex items-center justify-center">
            <AlertTriangle size={16} />
          </span>
          <div>
            <h1 className="text-base font-semibold text-[var(--color-text)]">This page could not be loaded</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              The rest of <BrandName /> is still available. Retry, or pick another section from the sidebar.
            </p>
            {error.digest && (
              <p className="text-xs text-[var(--color-muted-fg)] mt-2 font-mono">Reference: {error.digest}</p>
            )}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={reset}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90"
              >
                Try again
              </button>
              <Link
                href="/crm/dashboard"
                className="px-3 py-1.5 rounded-md text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
