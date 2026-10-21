import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-6 text-center">
        <div className="mx-auto w-10 h-10 rounded-full bg-[var(--color-muted)] text-[var(--color-muted-fg)] flex items-center justify-center mb-4">
          <FileQuestion size={18} />
        </div>
        <h1 className="text-base font-semibold text-[var(--color-text)]">Not found</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">
          This record does not exist, or you do not have access to it.
        </p>
        <Link
          href="/crm/dashboard"
          className="inline-block mt-5 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
