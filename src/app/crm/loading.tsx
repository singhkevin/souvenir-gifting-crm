import { BrandName } from '@/components/brand/brand-name'

export default function CrmLoading() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Title skeleton */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-10 w-64 bg-[#FCF9F2] border border-[#CCC5BD] rounded-none animate-pulse" />
          <div className="h-3 w-40 bg-[#FCF9F2] border border-[#CCC5BD] rounded-none animate-pulse" />
        </div>
        <div className="h-9 w-32 bg-[#FCF9F2] border border-[#CCC5BD] rounded-none animate-pulse" />
      </div>

      {/* KPI strip skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 bg-[#FCF9F2] border border-[#CCC5BD] rounded-none p-3.5 flex flex-col justify-between animate-pulse"
          >
            <div className="h-2.5 w-16 bg-[#F6F3EC] border border-[#CCC5BD]/60 rounded-none" />
            <div className="h-7 w-20 bg-[#F6F3EC] border border-[#CCC5BD]/60 rounded-none" />
          </div>
        ))}
      </div>

      {/* Panels skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-[#FCF9F2] border border-[#CCC5BD] rounded-none animate-pulse" />
        <div className="h-64 bg-[#FCF9F2] border border-[#CCC5BD] rounded-none animate-pulse" />
      </div>

      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
        Loading <BrandName />…
      </p>
    </div>
  )
}
