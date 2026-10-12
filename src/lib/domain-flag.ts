/** Domain split is off unless DOMAIN_SPLIT is 1, true, on, or yes. */
export function domainSplitEnabled(): boolean {
  const raw = (process.env.DOMAIN_SPLIT || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}
