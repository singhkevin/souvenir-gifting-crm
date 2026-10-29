import { emailDomain, normalizeEmailDomain } from '@/lib/pricing/domains'

/**
 * Free inboxes blocked from business self-registration.
 * Add a provider here when a new public host shows up. The app checks this list before registration.
 */
export const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'hotmail.com', 'hotmail.co.uk',
  'outlook.com', 'outlook.co.in', 'live.com', 'live.in', 'msn.com', 'aol.com', 'icloud.com', 'me.com',
  'proton.me', 'protonmail.com', 'zoho.com', 'yandex.com', 'gmx.com', 'mail.com', 'rediffmail.com',
] as const

const FREE_MAIL = new Set<string>(FREE_EMAIL_DOMAINS)

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

/**
 * Business sign-up must use a work email.
 * Free and disposable domains are blocked unless an admin added that domain to the allowlist.
 */
export function workEmailBlock(email: string, allowlist: string[] | null | undefined): string | null {
  const domain = emailDomain(email)
  if (!domain) return 'A valid work email is required'
  const allowed = new Set(
    (allowlist || []).map((entry) => normalizeEmailDomain(entry)).filter((entry): entry is string => Boolean(entry)),
  )
  if (allowed.has(domain)) return null
  if (FREE_MAIL.has(domain) || DISPOSABLE.has(domain)) {
    return 'Use a work email. Free inboxes such as Gmail, Yahoo, and Outlook are not accepted.'
  }
  return null
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
  if ((type === 'corporate' || type === 'direct') && (company.status || '') === 'active') return false
  return true
}
