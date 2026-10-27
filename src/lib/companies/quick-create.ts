import { normalizeEmailDomain } from '@/lib/pricing/domains'

/** One host from a quick-add domain field: bare domain, URL, or email. */
export function domainFromQuickEntry(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    return normalizeEmailDomain(new URL(withProtocol).hostname)
  } catch {
    return normalizeEmailDomain(trimmed)
  }
}

export function domainsFromQuickEntry(raw: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const part of raw.split(/[\s,;]+/)) {
    const domain = domainFromQuickEntry(part)
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    out.push(domain)
  }
  return out
}

/**
 * Map the quick-add fields (name, domain, city) onto the inputs `createCompany` already reads.
 * Does not insert anything.
 */
export function applyQuickCompanyFields(formData: FormData): { error?: string } {
  const name = String(formData.get('name') || '').trim()
  if (!name) return { error: 'Company name is required' }
  formData.set('name', name)

  const city = String(formData.get('city') || '').trim()
  if (city) formData.set('city', city)
  else formData.delete('city')

  const domainRaw = String(formData.get('domain') || '').trim()
  if (!domainRaw) return {}

  const domains = domainsFromQuickEntry(domainRaw)
  if (domains.length === 0) return { error: 'Enter a domain such as acme.com' }
  formData.set('allowed_email_domains', domains.join(', '))

  if (!String(formData.get('website') || '').trim()) {
    if (/^https?:\/\//i.test(domainRaw) && domains.length === 1) formData.set('website', domainRaw)
    else if (domains.length === 1) formData.set('website', `https://${domains[0]}`)
  }
  return {}
}
