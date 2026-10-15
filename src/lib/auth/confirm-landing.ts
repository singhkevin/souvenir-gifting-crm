import { isSafeNext } from '@/lib/safe-next'

const CONFIRM_TYPES = new Set(['email', 'magiclink', 'signup', 'invite'])

export function isAccountConfirmType(type: string | null | undefined) {
  return Boolean(type && CONFIRM_TYPES.has(type))
}

/** Where a confirmed account lands. The session from verifyOtp stays on this host. */
export function confirmLandingPath(type: string | null | undefined, next: string | null | undefined) {
  if (!isAccountConfirmType(type)) return null
  if (next === '/gift') return '/gift'
  return isSafeNext(next) ? next : '/business/dashboard'
}

/**
 * Confirmation link on the account's own host.
 * Supabase action_link follows the project Site URL, which is the wrong host for a store account.
 */
export function businessConfirmUrl(
  origin: string,
  link: { hashedToken?: string | null; verificationType?: string | null; actionLink?: string | null },
) {
  const token = String(link.hashedToken || '').trim()
  if (!token) return String(link.actionLink || '')
  const url = new URL('/auth/confirm', origin)
  url.searchParams.set('token_hash', token)
  url.searchParams.set('type', link.verificationType || 'magiclink')
  url.searchParams.set('next', '/business/dashboard')
  return url.toString()
}
