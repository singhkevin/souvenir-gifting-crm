import { customerKindLabel } from '@/lib/companies/customer-kind'

export function CustomerKindBadge({
  accountType,
  isIndividual,
}: {
  accountType?: string | null
  isIndividual?: boolean | null
}) {
  const label = customerKindLabel(accountType, isIndividual)
  const className =
    accountType === 'business'
      ? 'border-[#9E4300]/30 bg-[#FFB690]/30 text-[#9E4300]'
      : accountType === 'direct'
        ? 'border-[#1C1B1A]/30 bg-[#F6F3EC] text-[#1C1B1A]'
        : 'border-[#3A4537]/20 bg-[#DAE6D3] text-[#3A4537]'
  return (
    <span className={`inline-block rounded-none border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}>
      {label}
    </span>
  )
}
