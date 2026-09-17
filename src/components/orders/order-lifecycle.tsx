import {
  ORDER_LIFECYCLE,
  ORDER_STATUS_LABELS,
  CLIENT_STATUS_LABELS,
  lifecycleIndex,
} from '@/lib/order-workflow'
import { formatDate } from '@/lib/utils'

export type LifecycleHistoryEntry = {
  to_status?: string | null
  changed_at?: string | null
  changer?: { full_name?: string | null } | { full_name?: string | null }[] | null
}

function firstReached(history: LifecycleHistoryEntry[] | null | undefined) {
  const map = new Map<string, { at: string | null; by: string | null }>()
  const chronological = [...(history || [])].reverse()
  for (const entry of chronological) {
    const status = entry.to_status
    if (!status || map.has(status)) continue
    const changer = Array.isArray(entry.changer) ? entry.changer[0] : entry.changer
    map.set(status, { at: entry.changed_at || null, by: changer?.full_name || null })
  }
  return map
}

export function OrderLifecycleBar({
  status,
  history,
  variant = 'staff',
  compact = false,
  showActors = true,
}: {
  status: string
  history?: LifecycleHistoryEntry[] | null
  variant?: 'staff' | 'client'
  compact?: boolean
  showActors?: boolean
}) {
  const labels = variant === 'client' ? CLIENT_STATUS_LABELS : ORDER_STATUS_LABELS
  const current = lifecycleIndex(status)
  const cancelled = status === 'cancelled'
  const delivered = status === 'delivered'
  const reached = firstReached(history)

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 min-w-[88px]" title={labels[status] || status}>
        {ORDER_LIFECYCLE.map((step, idx) => {
          const done = !cancelled && (delivered || idx < current)
          const isCurrent = !cancelled && !delivered && idx === current
          return (
            <span
              key={step}
              className={`h-1.5 flex-1 rounded-full ${
                cancelled
                  ? 'bg-gray-200'
                  : done
                    ? 'bg-[#806A50]'
                    : isCurrent
                      ? 'bg-[#624B32]'
                      : 'bg-[#E5DFD5]'
              }`}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {cancelled && (
        <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          This order is cancelled.
        </p>
      )}
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {ORDER_LIFECYCLE.map((step, idx) => {
          const done = !cancelled && (delivered || idx < current)
          const isCurrent = !cancelled && !delivered && idx === current
          const info = reached.get(step)
          return (
            <li
              key={step}
              className={`flex-1 min-w-[92px] rounded-xl border px-2.5 py-2 ${
                isCurrent
                  ? 'border-[#624B32] bg-[#624B32]/5'
                  : done
                    ? 'border-[#806A50]/20 bg-[#FAF7F2]'
                    : 'border-[#E5DFD5] bg-white'
              }`}
            >
              <p className={`text-[10px] font-semibold leading-tight ${
                isCurrent ? 'text-[#624B32]' : done ? 'text-[#806A50]' : 'text-[#9A9288]'
              }`}>
                {done ? '✓' : isCurrent ? '●' : '○'} {labels[step] || step}
              </p>
              {isCurrent && (
                <p className="text-[10px] font-medium text-[#624B32] mt-1">Current</p>
              )}
              {info?.at && (
                <p className="text-[10px] text-[#7A7267] mt-1">{formatDate(info.at)}</p>
              )}
              {showActors && info?.by && (
                <p className="text-[10px] text-[#7A7267] truncate">{info.by}</p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
