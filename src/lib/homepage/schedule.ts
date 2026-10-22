import type { HomepageSlot, Schedule } from './types'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Today's date in India (Asia/Kolkata) as YYYY-MM-DD. */
export function indiaDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * Inclusive window check. Missing ends are open. With repeatYearly the year is ignored
 * and a window may wrap the new year (for example 20 Dec to 5 Jan).
 */
export function inWindow(schedule: Schedule | null | undefined, date: string): boolean {
  if (!schedule) return true
  const start = isIsoDate(schedule.startsOn) ? schedule.startsOn : null
  const end = isIsoDate(schedule.endsOn) ? schedule.endsOn : null
  if (!start && !end) return true
  if (!schedule.repeatYearly) {
    if (start && date < start) return false
    if (end && date > end) return false
    return true
  }
  const day = date.slice(5)
  const startDay = start ? start.slice(5) : null
  const endDay = end ? end.slice(5) : null
  if (startDay && endDay) {
    if (startDay <= endDay) return day >= startDay && day <= endDay
    return day >= startDay || day <= endDay
  }
  if (startDay) return day >= startDay
  return day <= (endDay as string)
}

/**
 * Highest priority first; ties go to the most recent start date, then the newest slot.
 * Only slots whose window contains `date`.
 */
export function activeSlots(slots: HomepageSlot[], date: string): HomepageSlot[] {
  return slots
    .filter((slot) => inWindow(slot.content.schedule, date))
    .sort((a, b) => {
      const priority = (b.content.priority || 0) - (a.content.priority || 0)
      if (priority) return priority
      const startA = a.content.schedule?.startsOn || ''
      const startB = b.content.schedule?.startsOn || ''
      if (startA !== startB) return startB.localeCompare(startA)
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    })
}
