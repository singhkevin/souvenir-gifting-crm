import { landingPathForRole, isSafeNext } from '@/lib/safe-next'
import { confirmNextAllowed } from '@/lib/portal/separation'

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

/** Same as confirmLandingPath, but the destination has to belong to this account's product. */
export function confirmLandingForRole(
  role: string | null | undefined,
  type: string | null | undefined,
  next: string | null | undefined,
) {
  if (!isAccountConfirmType(type)) return null
  if (confirmNextAllowed(role, next)) return next
  return landingPathForRole(role)
}

/** Set-password link on the company portal host. Recovery lands on /reset-password. */
export function portalSetPasswordUrl(
  origin: string,
  link: { hashedToken?: string | null; verificationType?: string | null; actionLink?: string | null },
) {
  const token = String(link.hashedToken || '').trim()
  if (!token) return String(link.actionLink || '')
  const url = new URL('/auth/confirm', origin)
  url.searchParams.set('token_hash', token)
  url.searchParams.set('type', link.verificationType || 'recovery')
  return url.toString()
}

export function portalConfirmUrl(
  origin: string,
  link: { hashedToken?: string | null; verificationType?: string | null; actionLink?: string | null },
) {
  const token = String(link.hashedToken || '').trim()
  if (!token) return String(link.actionLink || '')
  const url = new URL('/auth/confirm', origin)
  url.searchParams.set('token_hash', token)
  url.searchParams.set('type', link.verificationType || 'magiclink')
  url.searchParams.set('next', '/portal/awaiting')
  return url.toString()
}

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
