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

/** Offline fallback when email_domain_rules is not applied yet. The migration seeds the same domains. */
export const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'dispostable.com',
] as const

const DISPOSABLE = new Set<string>(DISPOSABLE_EMAIL_DOMAINS)

export type EmailDomainRuleName = 'allow' | 'block_free' | 'block_disposable'

export type EmailDomainRule = {
  domain: string
  rule: EmailDomainRuleName
}

export function emailDomainRuleChoice(value: string): EmailDomainRuleName | null {
  if (value === 'allow' || value === 'block_free' || value === 'block_disposable') return value
  return null
}

export type EmailDomainFlags = {
  domain: string | null
  freeMail: boolean
  disposable: boolean
  possibleClientName: string | null
}

export function emailDomainRule(
  domain: string | null,
  rules: EmailDomainRule[] | null | undefined,
): EmailDomainRuleName | null {
  if (!domain || !rules) return null
  const match = rules.find((rule) => normalizeEmailDomain(rule.domain) === domain)
  return match?.rule ?? null
}

export function classifyBusinessEmail(
  email: string,
  corporateDomains: { name: string; domains: string[] | null | undefined }[],
  rules?: EmailDomainRule[] | null,
): EmailDomainFlags {
  const domain = emailDomain(email)
  const possible = domain
    ? corporateDomains.find((company) =>
        (company.domains || []).some((entry) => normalizeEmailDomain(entry) === domain),
      )
    : null
  const rule = emailDomainRule(domain, rules)
  const freeMail = rules
    ? rule === 'block_free'
    : Boolean(domain && FREE_MAIL.has(domain))
  const disposable = rules
    ? rule === 'block_disposable'
    : Boolean(domain && DISPOSABLE.has(domain))
  return {
    domain,
    freeMail,
    disposable,
    possibleClientName: possible?.name || null,
  }
}

/**
 * A microsite client's domain cannot open a business account.
 * Direct customers (account_type direct) and business accounts are not microsites.
 */
export function micrositeDomainConflict(
  email: string,
  companies: {
    name: string
    domains: string[] | null | undefined
    account_type?: string | null
    status?: string | null
  }[],
): { name: string } | null {
  const domain = emailDomain(email)
  if (!domain) return null
  const hit = companies.find((company) => {
    const type = company.account_type || 'corporate'
    if (type !== 'corporate') return false
    if (company.status && company.status !== 'active') return false
    return (company.domains || []).some((entry) => normalizeEmailDomain(entry) === domain)
  })
  return hit ? { name: hit.name } : null
}

/** CRM review flag. An allow rule is an exception and is not flagged. Null rules use the offline lists. */
export function emailReviewFlag(
  email: string,
  rules?: EmailDomainRule[] | null,
): 'free' | 'disposable' | null {
  const domain = emailDomain(email)
  if (!domain) return null
  const rule = rules
    ? emailDomainRule(domain, rules)
    : FREE_MAIL.has(domain)
      ? 'block_free'
      : DISPOSABLE.has(domain)
        ? 'block_disposable'
        : null
  if (rule === 'block_free') return 'free'
  if (rule === 'block_disposable') return 'disposable'
  return null
}

/**
 * Business sign-up must use a work email.
 * Free and disposable domains are blocked unless an admin added that domain to the allowlist.
 */
export function workEmailBlock(
  email: string,
  allowlist: string[] | null | undefined,
  rules?: EmailDomainRule[] | null,
): string | null {
  const domain = emailDomain(email)
  if (!domain) return 'A valid work email is required'
  if (rules) {
    const rule = emailDomainRule(domain, rules)
    if (rule === 'allow') return null
    if (rule === 'block_free' || rule === 'block_disposable') {
      return 'Use a work email. Free inboxes such as Gmail, Yahoo, and Outlook are not accepted.'
    }
    return null
  }
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
  if (type === 'corporate' && (company.status || '') === 'active') return false
  return true
}
