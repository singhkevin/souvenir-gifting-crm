import { emailDomain, normalizeEmailDomain } from '@/lib/pricing/domains'

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com',
  'outlook.com', 'live.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me',
  'protonmail.com', 'zoho.com', 'yandex.com', 'gmx.com', 'mail.com', 'rediffmail.com',
])

const DISPOSABLE = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'dispostable.com',
])

export type EmailDomainFlags = {
  domain: string | null
  freeMail: boolean
  disposable: boolean
  possibleClientName: string | null
}

export function classifyBusinessEmail(
  email: string,
  corporateDomains: { name: string; domains: string[] | null | undefined }[],
): EmailDomainFlags {
  const domain = emailDomain(email)
  const possible = domain
    ? corporateDomains.find((company) =>
        (company.domains || []).some((entry) => normalizeEmailDomain(entry) === domain),
      )
    : null
  return {
    domain,
    freeMail: Boolean(domain && FREE_MAIL.has(domain)),
    disposable: Boolean(domain && DISPOSABLE.has(domain)),
    possibleClientName: possible?.name || null,
  }
}

export function registrationNotes(flags: EmailDomainFlags, taxId?: string | null) {
  const parts = ['Registered from the business portal.']
  if (flags.freeMail) parts.push('Flag: free-mail domain. Left unverified.')
  if (flags.disposable) parts.push('Flag: disposable domain. Left unverified.')
  if (flags.possibleClientName) parts.push(`Possible existing client: ${flags.possibleClientName}. Not attached.`)
  const tax = String(taxId || '').trim()
  if (tax) parts.push(`Tax ID: ${tax}`)
  return parts.join(' ')
}

/** Anonymous website enquiries must not attach to an active corporate company by name. */
export function shouldAttachNamedCompany(company: {
  status?: string | null
  account_type?: string | null
} | null) {
  if (!company) return false
  const type = company.account_type || 'corporate'
  if (type === 'corporate' && (company.status || '') === 'active') return false
  return true
}
