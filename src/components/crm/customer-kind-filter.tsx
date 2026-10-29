import Link from 'next/link'

const OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'corporate', label: 'Microsite client' },
  { value: 'business', label: 'Business' },
  { value: 'direct', label: 'Direct' },
] as const

export function CustomerKindFilter({
  pathname,
  current,
  preserve = {},
  paramName = 'customer',
}: {
  pathname: string
  current: string
  preserve?: Record<string, string>
  paramName?: string
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {OPTIONS.map((option) => {
        const params = new URLSearchParams()
        for (const [key, value] of Object.entries(preserve)) {
          if (value) params.set(key, value)
        }
        if (option.value) params.set(paramName, option.value)
        const query = params.toString()
        const href = query ? `${pathname}?${query}` : pathname
        const active = (current || '') === option.value
        return (
          <Link
            key={option.value || 'all'}
            href={href}
            className={`rounded-none px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors ${
              active
                ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                : 'border border-[#CCC5BD] bg-[#FCF9F2] text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            {option.label}
          </Link>
        )
      })}
    </div>
  )
}
