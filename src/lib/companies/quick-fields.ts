import { normalizeDomain } from '@/lib/companies/identity'
import { parseAllowedEmailDomains } from '@/lib/pricing/domains'

/** Map the quick-add Domain field onto the company website and email-domain allowlist. */
export function applyCompanyDomainField(formData: FormData): { error: string } | null {
  const domainRaw = String(formData.get('domain') || '').trim()
  if (!domainRaw) return null
  const host = normalizeDomain(domainRaw)
  if (!host || !host.includes('.') || /[\s/:]/.test(host) || host.startsWith('.')) {
    return { error: 'Enter a domain like acme.com' }
  }
  if (!String(formData.get('website') || '').trim()) {
    formData.set('website', `https://${host}`)
  }
  if (!String(formData.get('allowed_email_domains') || '').trim()) {
    const domains = parseAllowedEmailDomains(host)
    if (!domains.length) return { error: 'Enter a domain like acme.com' }
    formData.set('allowed_email_domains', domains.join(', '))
  }
  return null
}
