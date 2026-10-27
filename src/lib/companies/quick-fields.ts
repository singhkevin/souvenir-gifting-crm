import { parseAllowedEmailDomains } from '@/lib/pricing/domains'

/** Trimmed company name for the requirement quick-add modal. */
export function normalizeQuickCompanyName(raw: string): string | { error: string } {
  const name = raw.trim()
  if (!name) return { error: 'Company name is required' }
  return name
}

/**
 * Domain field on the quick-add modal. Empty is allowed.
 * A URL is reduced to its host, then parsed with the same allowlist rules as the company form.
 */
export function normalizeQuickCompanyDomains(raw: string): string[] | { error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return []
  const host = trimmed.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] || ''
  const domains = parseAllowedEmailDomains(host)
  if (domains.length === 0) return { error: 'Enter a domain like acme.com' }
  return domains
}

export function normalizeQuickCompanyCity(raw: string): string | null {
  const city = raw.trim()
  return city || null
}
