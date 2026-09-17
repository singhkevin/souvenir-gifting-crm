'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

export function PriceRangeFilter({
  bounds,
  value,
  basePath,
  preserveParams,
}: {
  /** Absolute slider bounds, e.g. { min: 0, max: 5000 }. */
  bounds: { min: number; max: number }
  /** Currently-applied filter range (falls back to bounds when unset). */
  value: { min: number; max: number }
  basePath: string
  /** Other active query params to keep when the range changes. */
  preserveParams: Record<string, string>
}) {
  const router = useRouter()
  // Mount fresh whenever `value` changes (parent passes a key derived from it),
  // so this local copy never needs to re-sync from an effect.
  const [range, setRange] = useState(value)
  const timeoutRef = useRef<number | null>(null)

  const push = (next: { min: number; max: number }) => {
    const params = new URLSearchParams()
    Object.entries(preserveParams).forEach(([key, val]) => {
      if (val) params.set(key, val)
    })
    if (next.min > bounds.min) params.set('priceMin', String(next.min))
    else params.delete('priceMin')
    if (next.max < bounds.max) params.set('priceMax', String(next.max))
    else params.delete('priceMax')
    params.delete('page')
    const qs = params.toString()
    router.push(`${basePath}${qs ? `?${qs}` : ''}`)
  }

  const commit = (next: { min: number; max: number }) => {
    setRange(next)
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => push(next), 400)
  }

  const span = Math.max(bounds.max - bounds.min, 1)
  const leftPct = ((range.min - bounds.min) / span) * 100
  const rightPct = ((range.max - bounds.min) / span) * 100

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-[#5C6570]">
        <span>{formatCurrency(range.min)}</span>
        <span>{formatCurrency(range.max)}</span>
      </div>
      <div className="relative mt-3 h-5">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#E8E4DE]" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#806A50]"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={Math.max(1, Math.round(span / 100))}
          value={range.min}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), range.max - 1)
            commit({ min: next, max: range.max })
          }}
          className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 appearance-none bg-transparent"
          aria-label="Minimum price"
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={Math.max(1, Math.round(span / 100))}
          value={range.max}
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), range.min + 1)
            commit({ min: range.min, max: next })
          }}
          className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 appearance-none bg-transparent"
          aria-label="Maximum price"
        />
      </div>
    </div>
  )
}
