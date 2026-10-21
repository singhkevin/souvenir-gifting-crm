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
    console.error('Portal page error:', error.message, error.digest, error.stack);
  }, [error]);

  return (
    <div className="max-w-lg rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-[#BA1A1A] bg-[#FFDAD6] text-[#BA1A1A]">
          <AlertTriangle size={18} />
        </span>
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-newsreader)] text-2xl font-normal tracking-tight text-[#1C1C18]">
            This page could not be loaded
          </h1>
          <p className="mt-2 text-sm text-[#4A4640]">
            Please try again in a moment.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center rounded-none bg-[#000000] px-5 py-2.5 sv2-label text-[11px] text-white transition-colors hover:bg-[#9E4300]"
            >
              Try again
            </button>
            <Link
              href="/portal"
              className="inline-flex items-center justify-center rounded-none border border-[#CCC5BD] bg-transparent px-5 py-2.5 sv2-label text-[11px] text-[#1C1C18] transition-colors hover:border-[#1C1B1A] hover:bg-[#F6F3EC]"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
