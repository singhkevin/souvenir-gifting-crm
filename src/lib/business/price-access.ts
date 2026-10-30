export type BusinessPriceAccess = 'anonymous' | 'pending' | 'rejected' | 'open'

export const BUSINESS_PRICE_SIGN_IN = 'Sign in to see prices'
export const BUSINESS_PRICE_AWAITING = 'Awaiting approval'
export const BUSINESS_WRONG_ACCOUNT = "You're signed in with a shop account · Sign out and use your work email"
export const BUSINESS_WRONG_STAFF = "You're signed in with a staff account · Sign out and use your work email"
export const BUSINESS_EMAIL_BLOCKED = "This email can't use the business portal · Contact us"

export function businessPriceNotice(access: BusinessPriceAccess): string | null {
  if (access === 'open') return null
  if (access === 'pending') return BUSINESS_PRICE_AWAITING
  if (access === 'rejected') return 'This business account is not approved.'
  return BUSINESS_PRICE_SIGN_IN
}

/** Retail prompt: once per session, and never after a Retail / Business choice cookie. */
export function shouldShowBusinessPrompt(input: {
  choiceCookie: string | null | undefined
  seenThisSession: boolean
}) {
  if (input.choiceCookie === 'retail' || input.choiceCookie === 'corporate') return false
  return !input.seenThisSession
}

export const BUSINESS_PROMPT_DELAY_MS = 2000
