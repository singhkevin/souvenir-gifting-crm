import { Briefcase, Building2, Store } from 'lucide-react'
import { corporateLabel, type ChannelSummary } from '@/lib/products/channel-visibility'

function Badge({ on, icon, label, title }: { on: boolean; icon: React.ReactNode; label: string; title: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-none ${
        on ? 'border-[#3A4537]/25 bg-[#DAE6D3] text-[#3A4537]' : 'border-[#CCC5BD] bg-[#F6F3EC] text-[#9C958C] line-through decoration-[#9C958C]/60'
      }`}
    >
      {icon}
      {label}
    </span>
  )
}

/** Small Retail / Business / Corporate badges for a product. */
export function ChannelBadges({ summary, compact = false }: { summary: ChannelSummary; compact?: boolean }) {
  const corporate = corporateLabel(summary)
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge
        on={summary.store}
        icon={<Store className="h-3 w-3" />}
        label={compact ? 'R' : 'Retail'}
        title={summary.store ? 'Shown on the retail store' : 'Hidden from the retail store'}
      />
      <Badge
        on={summary.business}
        icon={<Briefcase className="h-3 w-3" />}
        label={compact ? 'B' : 'Business'}
        title={summary.business ? 'Shown on the business portal' : 'Hidden from the business portal'}
      />
      <Badge
        on={summary.corporate !== 'none'}
        icon={<Building2 className="h-3 w-3" />}
        label={compact ? 'C' : `Corporate · ${corporate}`}
        title={`Corporate visibility: ${corporate}`}
      />
    </span>
  )
}
