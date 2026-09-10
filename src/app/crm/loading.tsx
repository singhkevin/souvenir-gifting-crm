import { BrandName } from '@/components/brand/brand-name'

export default function CrmLoading() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="h-7 w-48 bg-[#E5DFD5] rounded animate-pulse" />
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-white border border-[#E5DFD5] rounded-xl animate-pulse" />
        ))}
      </div>
      <p className="text-xs text-[#7A7267] mt-6">
        Loading <BrandName />…
      </p>
    </div>
  )
}
