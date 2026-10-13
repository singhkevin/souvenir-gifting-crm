'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Portal page error:', error.message, error.digest, error.stack)
  }, [error])

  return (
    <div className="max-w-lg bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-8 h-8 shrink-0 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center">
          <AlertTriangle size={16} />
        </span>
        <div>
          <h1 className="text-base font-semibold text-gray-900">This page could not be loaded</h1>
          <p className="text-sm text-gray-600 mt-1">Please try again in a moment.</p>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--color-primary)] text-white hover:text-white hover:opacity-90"
            >
              Try again
            </button>
            <Link
              href="/portal"
              className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
