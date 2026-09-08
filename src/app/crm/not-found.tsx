import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function CrmNotFound() {
  return (
    <div>
      <div className="max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-8 h-8 shrink-0 rounded-md bg-[var(--color-muted)] text-[var(--color-muted-fg)] flex items-center justify-center">
            <FileQuestion size={16} />
          </span>
          <div>
            <h1 className="text-base font-semibold text-[var(--color-text)]">Record not found</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              This record does not exist, has been removed, or is outside your access.
            </p>
            <Link
              href="/crm/dashboard"
              className="inline-block mt-4 px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:opacity-90"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
