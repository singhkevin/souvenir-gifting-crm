import { emailReviewFlag } from '@/lib/business/email-domain'
import { emailDomain, isEmailAllowedForDomains, normalizeEmailDomain } from '@/lib/pricing/domains'

/** Company portal self sign-up. Manual is the default: a matching domain is not a reviewed person. */
export const PORTAL_SIGNUP_MODES = ['off', 'manual', 'auto_domain', 'auto_all'] as const
export type PortalSignupMode = (typeof PORTAL_SIGNUP_MODES)[number]
export type PortalSignupSource = 'self' | 'staff' | 'invite'
export type PortalApproval = 'pending' | 'approved' | 'rejected'

export const DEFAULT_PORTAL_SIGNUP_MODE: PortalSignupMode = 'manual'
export const PORTAL_AWAITING = 'Awaiting approval'

export const PORTAL_SIGNUP_MODE_OPTIONS: { value: PortalSignupMode; label: string }[] = [
  { value: 'off', label: 'Off · no self sign-up' },
  { value: 'manual', label: 'Manual · approve each person' },
  { value: 'auto_domain', label: 'Auto · allowed domain after email confirmation' },
  { value: 'auto_all', label: 'Auto all · also staff and admin invites' },
]

export function parsePortalSignupMode(
  value: unknown,
  fallback?: PortalSignupMode,
): PortalSignupMode | { error: string } {
  const raw = String(value ?? '').trim()
  if (!raw && fallback) return fallback
  if ((PORTAL_SIGNUP_MODES as readonly string[]).includes(raw)) return raw as PortalSignupMode
  return { error: 'Choose a portal sign-up setting.' }
}

export function signupSourceLabel(source: string | null | undefined) {
  if (source === 'self') return 'Self'
  if (source === 'staff') return 'Staff'
  if (source === 'invite') return 'Invite'
  return 'Existing'
}

/**
 * Self sign-up stays pending until the email is confirmed.
 * auto_domain and auto_all then approve a listed domain.
 * Staff and invite stays pending except Off (the person adding them is the approval)
 * and Auto all.
 */
export function initialPortalApproval(input: {
  mode: PortalSignupMode
  source: PortalSignupSource
  emailConfirmed: boolean
  domainAllowed: boolean
}): PortalApproval {
  if (input.source === 'self') {
    if (!input.emailConfirmed) return 'pending'
    if ((input.mode === 'auto_domain' || input.mode === 'auto_all') && input.domainAllowed) return 'approved'
    return 'pending'
  }
  if (input.mode === 'off' || input.mode === 'auto_all') return 'approved'
  return 'pending'
}

/** Fields an approval may write. Role and company are not among them. */
export function portalDecisionPatch(input: {
  decision: 'approved' | 'rejected'
  actorId: string
  now: string
}) {
  return {
    portal_approval: input.decision,
    portal_approved_by: input.actorId,
    portal_approved_at: input.now,
  }
}

export function canDecidePortalSignup(input: {
  actorId: string
  actorRole: string
  actorCompanyId: string | null
  actorApproval: string | null | undefined
  targetId: string
  targetRole: string
  targetCompanyId: string | null
}): { ok: true } | { ok: false; error: string } {
  if (!input.actorId || input.actorId === input.targetId) {
    return { ok: false, error: 'You cannot approve your own account.' }
  }
  if (input.targetRole !== 'client_admin' && input.targetRole !== 'client_user') {
    return { ok: false, error: 'This account is not a company portal user.' }
  }
  if (!input.targetCompanyId) {
    return { ok: false, error: 'This account is not linked to a company.' }
  }
  if (input.actorRole === 'admin' || input.actorRole === 'sales') return { ok: true }
  if (input.actorRole === 'client_admin' && input.actorCompanyId === input.targetCompanyId) {
    if (input.actorApproval === 'pending' || input.actorApproval === 'rejected') {
      return { ok: false, error: 'Your account cannot approve people yet.' }
    }
    return { ok: true }
  }
  return { ok: false, error: 'You cannot approve portal accounts.' }
}

export function portalSignupRefusal(input: {
  accountType: string | null | undefined
  portalStatus: string | null | undefined
  trialEndsAt: string | null | undefined
  mode: PortalSignupMode
  now?: number
}): string | null {
  const type = input.accountType || 'corporate'
  if (type === 'business') return 'Business accounts register on the business portal.'
  if (type === 'direct') return 'This customer has no company portal.'
  if (type !== 'corporate') return 'This company portal is not open for sign-up.'
  if (input.portalStatus === 'suspended' || input.portalStatus === 'cancelled') {
    return 'This company portal is suspended.'
  }
  if (input.portalStatus === 'trial' && input.trialEndsAt) {
    const ends = Date.parse(input.trialEndsAt)
    if (Number.isFinite(ends) && ends < (input.now ?? Date.now())) {
      return 'This company portal trial has ended.'
    }
  }
  if (input.mode === 'off') {
    return 'Self sign-up is turned off for this company. Ask your administrator for an account.'
  }
  return null
}

function listedDomains(allowedDomains: string[] | null | undefined) {
  return (allowedDomains || [])
    .map((entry) => normalizeEmailDomain(entry))
    .filter((entry): entry is string => Boolean(entry))
}

/** Self sign-up: the company list is the only allow. A business allow-rule does not count. */
export function portalSignupDomainRefusal(
  email: string,
  allowedDomains: string[] | null | undefined,
): string | null {
  const domain = emailDomain(email)
  if (!domain) return 'A valid email is required.'
  const allowed = listedDomains(allowedDomains)
  if (allowed.length === 0) {
    return 'This company has not listed an email domain for sign-up. Ask your administrator.'
  }
  if (!allowed.includes(domain)) {
    if (emailReviewFlag(email)) {
      return 'Free email addresses are not accepted unless this company lists that domain. Use your work email.'
    }
    return `Only @${allowed.join(', @')} addresses can register on this portal.`
  }
  return null
}

/**
 * Staff and company-admin adds keep the domain check.
 * An explicit exception is the only way around it.
 * An empty company list still refuses a free inbox unless that exception is set,
 * or the company has listed the domain.
 */
export function staffPortalEmailProblem(
  email: string,
  allowedDomains: string[] | null | undefined,
  exception: boolean,
): string | null {
  if (exception) return null
  const domain = emailDomain(email)
  if (!domain) return 'A valid email is required.'
  const allowed = listedDomains(allowedDomains)
  if (emailReviewFlag(email) && !allowed.includes(domain)) {
    return 'Free email addresses are not accepted unless this company lists that domain, or you record an exception.'
  }
  if (allowed.length === 0) return null
  if (!isEmailAllowedForDomains(email, allowed)) {
    return `Portal login email must use an allowed domain (${allowed.join(', ')}), or record an exception.`
  }
  return null
}

export function listedDomainAllowed(email: string, allowedDomains: string[] | null | undefined) {
  return portalSignupDomainRefusal(email, allowedDomains) === null
}
