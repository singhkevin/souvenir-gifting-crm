import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

/**
 * Deliberately generic. Clients must never be able to tell the difference
 * between "this does not exist" and "this exists but is not in your catalogue".
 */
export default function PortalNotFound() {
  return (
    <div className="max-w-lg rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-[#CCC5BD] bg-[#F1EEE7] text-[#7C766F]">
          <FileQuestion size={18} />
        </span>
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-newsreader)] text-2xl font-normal tracking-tight text-[#1C1C18]">
            Not available
          </h1>
          <p className="mt-2 text-sm text-[#4A4640]">
            This page is not available. It may have moved, or the link may be out of date.
          </p>
          <Link
            href="/portal/gifts"
            className="mt-6 inline-flex items-center justify-center rounded-none bg-[#000000] px-5 py-2.5 sv2-label text-[11px] text-white transition-colors hover:bg-[#9E4300]"
          >
            Browse gifts
          </Link>
        </div>
      </div>
    </div>
  );
}
