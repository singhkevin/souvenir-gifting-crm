/** A blank end date means the special price stays on. An end date includes that day. */
export function specialPriceActive(validUntil: string | null | undefined, today = new Date()): boolean {
  if (!validUntil) return true
  const end = String(validUntil).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return true
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return end >= stamp
}

// surfaceUnitPrice / listedUnitPrice (retail-based ladders) were removed with the cost-basis
// pricing change. Every sell price now goes through resolvePortalPrice in lib/pricing/engine.ts,
// mirrored by public.portal_unit_price in the database.
