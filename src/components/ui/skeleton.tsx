import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 ${className}`} />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full">
      <div className="border-b border-gray-200 bg-gray-50 flex py-3 px-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-4 flex-1 mx-2 first:ml-0 last:mr-0" />
        ))}
      </div>
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`row-${r}`} className="flex py-4 px-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={`cell-${r}-${c}`} className="h-4 flex-1 mx-2 first:ml-0 last:mr-0" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="border border-gray-200 p-4 bg-white space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="pt-4 border-t border-gray-100 flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="border border-gray-200 p-5 bg-white flex flex-col gap-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-1/4 mt-2" />
    </div>
  );
}
