/** Corporate portal email-domain allowlists. */

export function normalizeEmailDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase()
  if (!value) return null
  if (value.includes('@')) value = value.split('@').pop() || ''
  value = value.replace(/^www\./, '').replace(/^\.+|\.+$/g, '')
  if (!value || !value.includes('.') || /\s/.test(value)) return null
  return value
}

/** Parse comma / whitespace / newline separated domains into a unique list. */
export function parseAllowedEmailDomains(raw: string | null | undefined): string[] {
  if (!raw) return []
  const parts = raw.split(/[\s,;]+/)
  const out: string[] = []
  const seen = new Set<string>()
  for (const part of parts) {
    const domain = normalizeEmailDomain(part)
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    out.push(domain)
  }
  return out
}

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0) return null
  return normalizeEmailDomain(email.slice(at + 1))
}

/**
 * Empty allowlist = no restriction (backwards compatible).
 * Non-empty = email domain must match one entry.
 */
export function isEmailAllowedForDomains(
  email: string,
  allowedDomains: string[] | null | undefined
): boolean {
  const allowed = (allowedDomains || [])
    .map((d) => normalizeEmailDomain(d))
    .filter((d): d is string => Boolean(d))
  if (allowed.length === 0) return true
  const domain = emailDomain(email)
  if (!domain) return false
  return allowed.includes(domain)
}

export function formatAllowedEmailDomains(domains: string[] | null | undefined): string {
  return (domains || []).join(', ')
}
