import { emailReviewFlag, type EmailDomainRule } from '@/lib/business/email-domain'
import { minimumOrderQty } from '@/lib/business/lines'
import {
  BUSINESS_EMAIL_BLOCKED,
  BUSINESS_PRICE_AWAITING,
  BUSINESS_PRICE_SIGN_IN,
  BUSINESS_WRONG_ACCOUNT,
  BUSINESS_WRONG_STAFF,
  type BusinessPriceAccess,
} from '@/lib/business/price-access'
import { isBusinessRole, isClientRole, isGiftEmployeeRole, isRunnerRole, isStaffRole } from '@/lib/roles'
import type { PublicProduct } from '@/lib/catalogue/products'

export const BUSINESS_PORTAL_EMAIL = 'This email uses a company portal · Find your company portal'

export type BusinessAccessState =
  | 'signed_out'
  | 'wrong_account'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'blocked'
  | 'email_not_allowed'

export type BusinessAccessProfile = {
  id: string
  full_name: string | null
  email: string
  role: string
  department_id: string | null
  company_id: string | null
  is_active: boolean
}

export type BusinessAccessCompany = {
  id: string
  name: string
  account_type: string | null
  business_verification: string | null
  status?: string | null
  gst_number?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  website?: string | null
  notes?: string | null
  margin_percent?: number | null
}

export type BusinessAccess = {
  state: BusinessAccessState
  profile: BusinessAccessProfile | null
  company: BusinessAccessCompany | null
  reason: string | null
  emailReview: 'free' | 'disposable' | null
  canSeePrices: boolean
  canSubmitQuote: boolean
  priceNotice: string | null
  banner: string | null
}

function priceAccessOf(state: BusinessAccessState): BusinessPriceAccess {
  if (state === 'verified') return 'open'
  if (state === 'pending') return 'pending'
  if (state === 'rejected') return 'rejected'
  return 'anonymous'
}

/**
 * One decision for the business portal.
 * emailPolicy "flag" keeps an existing free-email account working.
 * emailPolicy "block" is the lock used when a domain must not sign in.
 */
export function resolveBusinessAccess(input: {
  profile: BusinessAccessProfile | null
  company: BusinessAccessCompany | null
  emailReview?: 'free' | 'disposable' | null
  rules?: EmailDomainRule[] | null
  emailPolicy?: 'flag' | 'block'
}): BusinessAccess {
  const emailPolicy = input.emailPolicy || 'flag'
  const profile = input.profile
  const company = input.company
  const emailReview = input.emailReview !== undefined
    ? input.emailReview
    : profile ? emailReviewFlag(profile.email, input.rules) : null

  const base = (state: BusinessAccessState, reason: string | null): BusinessAccess => {
    const blockedEmail = emailPolicy === 'block'
      && emailReview != null
      && (state === 'pending' || state === 'verified')
    const resolved = blockedEmail ? 'email_not_allowed' : state
    const open = resolved === 'verified'
    let banner: string | null = null
    if (resolved === 'wrong_account') {
      banner = profile && (isStaffRole(profile.role) || isRunnerRole(profile.role))
        ? BUSINESS_WRONG_STAFF
        : BUSINESS_WRONG_ACCOUNT
    } else if (resolved === 'email_not_allowed') {
      banner = BUSINESS_EMAIL_BLOCKED
    } else if (resolved === 'pending') {
      banner = 'Awaiting approval · prices open after we verify your company'
    }
    const priceNotice = open
      ? null
      : resolved === 'pending'
        ? BUSINESS_PRICE_AWAITING
        : resolved === 'rejected'
          ? 'This business account is not approved.'
          : resolved === 'email_not_allowed'
            ? BUSINESS_EMAIL_BLOCKED
            : BUSINESS_PRICE_SIGN_IN
    return {
      state: resolved,
      profile,
      company,
      reason: blockedEmail ? 'email_not_allowed' : reason,
      emailReview,
      canSeePrices: open,
      canSubmitQuote: open,
      priceNotice,
      banner,
    }
  }

  if (!profile) return base('signed_out', null)

  if (!isBusinessRole(profile.role)) {
    if (isClientRole(profile.role) || isGiftEmployeeRole(profile.role)) {
      return base('wrong_account', 'client')
    }
    if (isStaffRole(profile.role) || isRunnerRole(profile.role)) {
      return base('wrong_account', 'staff')
    }
    return base('wrong_account', 'retail')
  }

  if (!profile.is_active || company?.status === 'inactive') {
    return base('blocked', 'blocked')
  }

  if (!company || company.account_type !== 'business' || company.id !== profile.company_id) {
    return base('wrong_account', 'not_business_company')
  }

  if (company.business_verification === 'rejected') return base('rejected', 'rejected')
  if (company.business_verification === 'verified') return base('verified', null)
  return base('pending', 'pending')
}

/** Refusal when someone signs in on /business/login with another kind of account. */
export function businessAudienceRefusal(role: string | null | undefined): { error: string } | null {
  if (isBusinessRole(role)) return null
  if (isClientRole(role) || isGiftEmployeeRole(role)) return { error: BUSINESS_PORTAL_EMAIL }
  if (isStaffRole(role) || isRunnerRole(role)) return { error: BUSINESS_WRONG_STAFF }
  return { error: BUSINESS_WRONG_ACCOUNT }
}

export function priceAccessFromState(state: BusinessAccessState): BusinessPriceAccess {
  return priceAccessOf(state)
}

type PricedProduct = PublicProduct & {
  indicativePrice: number | null
  moqUnits: number
}

/** Drop retail and business prices unless this visitor is allowed to see them. */
export function presentBusinessProduct(
  product: PublicProduct,
  indicativePrice: number | null,
  priceNote: string | null,
  showPrices: boolean,
): PricedProduct {
  const price = showPrices && indicativePrice != null && Number.isFinite(indicativePrice) ? indicativePrice : null
  return {
    ...product,
    price,
    priceNote: price == null ? null : priceNote,
    indicativePrice: price,
    moqUnits: minimumOrderQty(product.moq),
  }
}
