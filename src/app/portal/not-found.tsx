import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

/**
 * Deliberately generic. Clients must never be able to tell the difference
 * between "this does not exist" and "this exists but is not in your catalogue".
 */
export default function PortalNotFound() {
  return (
    <div className="max-w-lg bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-8 h-8 shrink-0 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center">
          <FileQuestion size={16} />
        </span>
        <div>
          <h1 className="text-base font-semibold text-gray-900">Not available</h1>
          <p className="text-sm text-gray-600 mt-1">
            This page is not available. It may have moved, or the link may be out of date.
          </p>
          <Link
            href="/portal/gifts"
            className="inline-block mt-4 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--color-primary)] text-white hover:text-white hover:opacity-90"
          >
            Browse gifts
          </Link>
        </div>
      </div>
    </div>
  );
}
