'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, X } from 'lucide-react'

export type MobileFilterOption = {
  value: string
  label: string
  meta?: string
}

export type MobileFilterField = {
  key: string
  label: string
  value: string
  emptyLabel: string
  options: MobileFilterOption[]
}

export function MobileFilterSheetOption({
  label,
  meta,
  active,
  onSelect,
}: {
  label: string
  meta?: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3.5 text-left transition-colors ${
        active ? 'bg-[#1A3022] text-white' : 'text-[#1B2430] hover:bg-[#F6F4F1]'
      }`}
    >
      <span className="min-w-0 truncate text-[15px]">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {meta ? (
          <span className={`text-xs ${active ? 'text-white/70' : 'text-[#8A929C]'}`}>{meta}</span>
        ) : null}
        {active ? <Check size={16} className="text-white" /> : null}
      </span>
    </button>
  )
}

export function MobileFilterSheetShell({
  open,
  title,
  eyebrow = 'Filter',
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-[#1A3022]/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[85vh] overflow-hidden rounded-t-2xl bg-white shadow-[0_-12px_40px_rgba(27,36,48,0.18)]"
      >
        <div className="border-b border-[#E8E4DE] px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#D6CEBE]" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A929C]">
                {eyebrow}
              </p>
              <h2 id={titleId} className="mt-1 font-serif text-2xl text-[#1B2430]">
                {title}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F4F1] text-[#1A3022]"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="max-h-[min(58vh,28rem)] overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-width:thin]">
          {children}
        </div>
        {footer ? <div className="border-t border-[#E8E4DE] px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}

export function MobileFilterTrigger({
  label,
  value,
  onClick,
  disabled = false,
}: {
  label: string
  value: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-md border border-[#E8E4DE] bg-[#F6F4F1] px-3.5 py-3 text-left ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A929C]">
        {label}
      </span>
      <span className="mt-1.5 flex items-center justify-between gap-2 text-[15px] text-[#1B2430]">
        <span className="min-w-0 truncate">{value}</span>
        <ChevronDown size={16} className="shrink-0 text-[#1A3022]" />
      </span>
    </button>
  )
}

/** Filter bar: bottom sheets on mobile, native selects on desktop. */
export function MobileFilterBar({
  fields,
  pathname,
  preserveParams = {},
  className = '',
}: {
  fields: MobileFilterField[]
  pathname: string
  /** Extra query params to keep when a filter changes (e.g. search `q`, `view`). */
  preserveParams?: Record<string, string>
  className?: string
}) {
  const router = useRouter()
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = fields.find((field) => field.key === activeKey) || null

  const select = (key: string, value: string) => {
    const params = new URLSearchParams()
    Object.entries(preserveParams).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    // Clear page when filters change
    params.delete('page')
    if (value) params.set(key, value)
    else params.delete(key)
    fields.forEach((field) => {
      if (field.key === key) return
      if (field.value) params.set(field.key, field.value)
      else params.delete(field.key)
    })
    const qs = params.toString()
    setActiveKey(null)
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  const gridClass =
    fields.length === 1
      ? 'grid-cols-1'
      : fields.length === 3
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2'

  return (
    <div className={className}>
      {/* Mobile: bottom-sheet pickers */}
      <div className={`grid w-full gap-3 md:hidden ${gridClass}`}>
        {fields.map((field) => {
          const current =
            field.options.find((option) => option.value === field.value)?.label || field.emptyLabel
          return (
            <MobileFilterTrigger
              key={field.key}
              label={field.label}
              value={current}
              onClick={() => setActiveKey(field.key)}
            />
          )
        })}
      </div>

      <MobileFilterSheetShell
        open={Boolean(active)}
        title={active?.label || 'Filter'}
        onClose={() => setActiveKey(null)}
      >
        {active
          ? active.options.map((option) => (
              <MobileFilterSheetOption
                key={`${active.key}-${option.value || 'empty'}`}
                label={option.label}
                meta={option.meta}
                active={active.value === option.value}
                onSelect={() => select(active.key, option.value)}
              />
            ))
          : null}
      </MobileFilterSheetShell>

      {/* Desktop: native selects — no bottom sheet */}
      <div className={`hidden w-full gap-3 md:grid ${gridClass}`}>
        {fields.map((field) => (
          <label key={field.key} className="block min-w-0 space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">
              {field.label}
            </span>
            <select
              value={field.value}
              onChange={(event) => select(field.key, event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm text-[#1B2430]"
            >
              {field.options.map((option) => (
                <option key={`${field.key}-${option.value || 'empty'}`} value={option.value}>
                  {option.label}
                  {option.meta ? ` (${option.meta})` : ''}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  )
}

/** Date-range filter that opens a themed sheet on mobile; desktop keeps inline fields. */
export function MobileDateRangeFilter({
  from,
  to,
  action = '',
  clearHref,
  submitLabel = 'Apply',
  className = '',
  preserveParams = {},
  mobileOnly = false,
}: {
  from: string
  to: string
  action?: string
  clearHref?: string
  submitLabel?: string
  className?: string
  /** Extra query params to keep when applying/clearing the date range. */
  preserveParams?: Record<string, string>
  /** Hide the desktop inline form (when the page already has its own desktop filters). */
  mobileOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const formId = useId().replace(/:/g, '')
  const summary =
    from || to
      ? `${from || '…'} → ${to || '…'}`
      : 'Any period'

  const hiddenFields = Object.entries(preserveParams).filter(([, value]) => Boolean(value))

  return (
    <div className={`w-full min-w-0 ${className}`}>
      <div className={mobileOnly ? 'w-full' : 'w-full sm:hidden'}>
        <MobileFilterTrigger label="Period" value={summary} onClick={() => setOpen(true)} />
        <MobileFilterSheetShell
          open={open}
          title="Date range"
          eyebrow="Filter"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex gap-2">
              {clearHref ? (
                <a
                  href={clearHref}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-[#E8E4DE] bg-white px-3 text-sm font-semibold text-[#1B2430]"
                  onClick={() => setOpen(false)}
                >
                  Clear
                </a>
              ) : null}
              <button
                type="submit"
                form={`mobile-date-range-${formId}`}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-sm font-semibold text-white"
              >
                {submitLabel}
              </button>
            </div>
          }
        >
          <form id={`mobile-date-range-${formId}`} action={action || undefined} className="space-y-3 px-2 pb-2">
            {hiddenFields.map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A929C]">From</span>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="min-h-11 w-full rounded-lg border border-[#E8E4DE] bg-[#F6F4F1] px-3 text-base text-[#1B2430]"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A929C]">To</span>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="min-h-11 w-full rounded-lg border border-[#E8E4DE] bg-[#F6F4F1] px-3 text-base text-[#1B2430]"
              />
            </label>
          </form>
        </MobileFilterSheetShell>
      </div>

      {mobileOnly ? null : (
        <form
          action={action || undefined}
          className="hidden flex-wrap items-end gap-2 text-xs sm:flex"
        >
          {hiddenFields.map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <label className="space-y-1">
            <span className="text-[#7A7267]">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="block min-h-10 rounded-lg border bg-white px-2 py-1.5"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[#7A7267]">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="block min-h-10 rounded-lg border bg-white px-2 py-1.5"
            />
          </label>
          <button
            type="submit"
            className="min-h-10 rounded-lg bg-[#1A3022] px-3 py-1.5 font-semibold text-white hover:text-white"
          >
            {submitLabel}
          </button>
          {clearHref && (from || to) ? (
            <a href={clearHref} className="inline-flex min-h-10 items-center rounded-lg border px-3 py-1.5">
              Clear
            </a>
          ) : null}
        </form>
      )}
    </div>
  )
}

/** Themed sheet picker that replaces native <select> on mobile; desktop keeps a normal select. */
export function MobileSheetSelect({
  name,
  label,
  defaultValue = '',
  value: controlledValue,
  onChange,
  options,
  required,
  disabled = false,
  emptyLabel = 'Select',
  className = '',
  showDesktopLabel = false,
}: {
  name?: string
  label: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  options: MobileFilterOption[]
  required?: boolean
  disabled?: boolean
  emptyLabel?: string
  className?: string
  showDesktopLabel?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const value = controlledValue ?? uncontrolled
  const setValue = (next: string) => {
    if (controlledValue === undefined) setUncontrolled(next)
    onChange?.(next)
  }
  const currentLabel =
    options.find((option) => option.value === value)?.label || emptyLabel

  return (
    <div className={`w-full min-w-0 ${className}`}>
      {name ? <input type="hidden" name={name} value={value} required={required} disabled={disabled} /> : null}
      <div className="w-full md:hidden">
        <MobileFilterTrigger
          label={label}
          value={currentLabel}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setOpen(true)
          }}
        />
        <MobileFilterSheetShell open={open} title={label} onClose={() => setOpen(false)}>
          {options.map((option) => (
            <MobileFilterSheetOption
              key={`${name || label}-${option.value || 'empty'}`}
              label={option.label}
              meta={option.meta}
              active={value === option.value}
              onSelect={() => {
                setValue(option.value)
                setOpen(false)
              }}
            />
          ))}
        </MobileFilterSheetShell>
      </div>
      <label className="hidden w-full space-y-1 md:block">
        <span className={showDesktopLabel ? 'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]' : 'sr-only'}>
          {label}
        </span>
        <select
          value={value}
          required={required}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
        >
          {options.map((option) => (
            <option key={`${name || label}-opt-${option.value || 'empty'}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function formatSheetDate(value: string) {
  if (!value) return 'Pick a date'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Mobile bottom-sheet calendar; desktop uses a normal date input. */
export function SheetDateField({
  name,
  label,
  value: controlledValue,
  defaultValue = '',
  onChange,
  required,
  disabled = false,
  className = '',
  min,
  max,
  /** Show visible label above the desktop date input (portal forms). Compact CRM grids leave this off. */
  showDesktopLabel = false,
}: {
  name?: string
  label: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  required?: boolean
  disabled?: boolean
  className?: string
  min?: string
  max?: string
  showDesktopLabel?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const value = controlledValue ?? uncontrolled
  const setValue = (next: string) => {
    if (controlledValue === undefined) setUncontrolled(next)
    onChange?.(next)
  }

  const selected = value ? new Date(`${value}T00:00:00`) : null
  const initial = selected && !Number.isNaN(selected.getTime()) ? selected : new Date()
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth() + 1)

  useEffect(() => {
    if (!open) return
    const base = value ? new Date(`${value}T00:00:00`) : new Date()
    if (!Number.isNaN(base.getTime())) {
      setViewYear(base.getFullYear())
      setViewMonth(base.getMonth() + 1)
    }
  }, [open, value])

  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
  const startWeekday = new Date(viewYear, viewMonth - 1, 1).getDay()

  const minTime = min ? new Date(`${min}T00:00:00`).getTime() : null
  const maxTime = max ? new Date(`${max}T00:00:00`).getTime() : null

  const nowYear = new Date().getFullYear()
  const minYear = min ? new Date(`${min}T00:00:00`).getFullYear() : nowYear - 100
  const maxYear = max ? new Date(`${max}T00:00:00`).getFullYear() : nowYear + 10
  const yearOptions = Array.from(
    { length: Math.max(maxYear - minYear + 1, 1) },
    (_, index) => minYear + index,
  )

  const pickDay = (day: number) => {
    const next = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const time = new Date(`${next}T00:00:00`).getTime()
    if (minTime != null && time < minTime) return
    if (maxTime != null && time > maxTime) return
    setValue(next)
    setOpen(false)
  }

  return (
    <div className={`w-full min-w-0 ${className}`}>
      {name ? <input type="hidden" name={name} value={value} required={required} disabled={disabled} /> : null}

      <div className="md:hidden">
        <MobileFilterTrigger
          label={label}
          value={formatSheetDate(value)}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setOpen(true)
          }}
        />
        <MobileFilterSheetShell
          open={open}
          title={label}
          eyebrow="Date"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-[#E8E4DE] bg-white px-3 text-sm font-semibold text-[#1B2430]"
                onClick={() => {
                  setValue('')
                  setOpen(false)
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-sm font-semibold text-white"
                onClick={() => {
                  const today = new Date()
                  const next = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                  setValue(next)
                  setOpen(false)
                }}
              >
                Today
              </button>
            </div>
          }
        >
          <div className="space-y-3 px-2 pb-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6F4F1] text-[#1A3022]"
                onClick={() => {
                  const next = shiftMonth(viewYear, viewMonth, -1)
                  setViewYear(next.year)
                  setViewMonth(next.month)
                }}
                aria-label="Previous month"
              >
                ‹
              </button>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
                <select
                  value={viewMonth}
                  onChange={(event) => setViewMonth(Number(event.target.value))}
                  aria-label="Select month"
                  className="min-w-0 rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-sm font-semibold text-[#1B2430]"
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={viewYear}
                  onChange={(event) => setViewYear(Number(event.target.value))}
                  aria-label="Select year"
                  className="min-w-0 rounded-lg border border-[#E8E4DE] bg-white px-2 py-1.5 text-sm font-semibold text-[#1B2430]"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6F4F1] text-[#1A3022]"
                onClick={() => {
                  const next = shiftMonth(viewYear, viewMonth, 1)
                  setViewYear(next.year)
                  setViewMonth(next.month)
                }}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[#8A929C]">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <span key={day} className="py-1">
                  {day}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startWeekday }).map((_, index) => (
                <span key={`pad-${index}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const iso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const time = new Date(`${iso}T00:00:00`).getTime()
                const disabled =
                  (minTime != null && time < minTime) || (maxTime != null && time > maxTime)
                const active = value === iso
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickDay(day)}
                    className={`inline-flex min-h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#1A3022] text-white'
                        : disabled
                          ? 'cursor-not-allowed text-[#C4BDB3]'
                          : 'text-[#1B2430] hover:bg-[#F6F4F1]'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </MobileFilterSheetShell>
      </div>

      <label className="hidden w-full space-y-1 md:block">
        <span className={showDesktopLabel ? 'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]' : 'sr-only'}>{label}</span>
        <input
          type="date"
          value={value}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
        />
      </label>
    </div>
  )
}
