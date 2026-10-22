import type { ReactNode } from 'react'
import { needsClientInput } from '@/lib/homepage/form'
import type { Schedule } from '@/lib/homepage/types'

export const inputClass = 'mt-1 w-full border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#1C1B1A] focus:outline-none'
export const buttonClass = 'inline-flex items-center justify-center border border-[#1C1B1A] bg-[#1C1B1A] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#FCF9F2] hover:bg-[#9E4300] hover:border-[#9E4300]'
export const ghostButtonClass = 'inline-flex items-center justify-center border border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-700 hover:border-[#1C1B1A]'

export function Field({ label, hint, children, wide = false }: { label: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-gray-500">{hint}</span> : null}
    </label>
  )
}

/** Marks copy that still holds a placeholder such as "[X]". */
export function ClientInput({ value }: { value?: string | null }) {
  if (!needsClientInput(value)) return null
  return (
    <span className="mt-1 inline-block border border-[#9E4300] bg-[#FFE9DC] px-2 py-0.5 text-[11px] font-semibold text-[#9E4300]">
      Needs client input: replace the [bracketed] placeholder
    </span>
  )
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'live' | 'draft' | 'warn'; children: ReactNode }) {
  const tones = {
    neutral: 'border-gray-200 text-gray-600',
    live: 'border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]',
    draft: 'border-[#9E4300] bg-[#FFE9DC] text-[#9E4300]',
    warn: 'border-red-200 bg-red-50 text-red-700',
  }
  return <span className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${tones[tone]}`}>{children}</span>
}

export function scheduleLabel(schedule?: Schedule | null) {
  if (!schedule || (!schedule.startsOn && !schedule.endsOn)) return 'Always'
  const fmt = (value?: string | null) => (value ? (schedule.repeatYearly ? value.slice(5) : value) : '…')
  return `${fmt(schedule.startsOn)} to ${fmt(schedule.endsOn)}${schedule.repeatYearly ? ', every year' : ''}`
}

export function ScheduleFields({ schedule, prefix = '' }: { schedule?: Schedule | null; prefix?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Starts on (India date)">
        <input type="date" name={`${prefix}starts_on`} defaultValue={schedule?.startsOn || ''} className={inputClass} />
      </Field>
      <Field label="Ends on (inclusive)">
        <input type="date" name={`${prefix}ends_on`} defaultValue={schedule?.endsOn || ''} className={inputClass} />
      </Field>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="checkbox" name={`${prefix}repeat_yearly`} defaultChecked={Boolean(schedule?.repeatYearly)} />
        Repeat every year (same days)
      </label>
    </div>
  )
}

export function SetupNotice({ children }: { children: ReactNode }) {
  return <div className="mb-5 border border-[#9E4300] bg-[#FFE9DC] p-4 text-sm text-[#1C1C18]">{children}</div>
}
