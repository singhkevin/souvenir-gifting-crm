const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Earlier of the quote's valid-until end of day in IST, and seven days from now. */
export function quoteCheckoutExpiry(validUntil: string | null | undefined, now = Date.now()) {
  const week = now + WEEK_MS
  if (!validUntil) return new Date(week).toISOString()
  const day = String(validUntil).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Date(week).toISOString()
  const endOfDayIst = new Date(`${day}T23:59:59+05:30`).getTime()
  if (!Number.isFinite(endOfDayIst)) return new Date(week).toISOString()
  return new Date(Math.min(endOfDayIst, week)).toISOString()
}
