export type BusinessPriceAccess = 'anonymous' | 'pending' | 'rejected' | 'open'

export const BUSINESS_PRICE_SIGN_IN = 'Sign in with your work email to see business pricing'

export function businessPriceNotice(access: BusinessPriceAccess): string | null {
  if (access === 'open') return null
  if (access === 'pending') return 'Business pricing opens after this account is approved.'
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
