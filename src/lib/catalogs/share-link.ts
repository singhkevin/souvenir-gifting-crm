export const SHARE_LINK_DAYS = 30

export function isShareToken(value: string) {
  return /^[A-Za-z0-9_-]{16,128}$/.test(value)
}

export function sharePath(token: string) {
  return `/share/catalogs/${token}`
}

export function shareExpiryIso(from: Date, days = SHARE_LINK_DAYS) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

/** Push expiry 30 days past the later of now and the current expiry. A missing expiry starts from now. */
export function extendShareExpiry(currentExpiresAt: string | null | undefined, now: Date, days = SHARE_LINK_DAYS) {
  const base = currentExpiresAt ? new Date(currentExpiresAt) : now
  const baseMs = base.getTime()
  const from = Number.isFinite(baseMs) && baseMs > now.getTime() ? base : now
  return shareExpiryIso(from, days)
}

export type ShareLinkAccess = {
  revoked_at?: string | null
  expires_at?: string | null
}

export function shareLinkIsExpired(expiresAt: string | null | undefined, now = Date.now()) {
  if (!expiresAt) return false
  const expires = new Date(expiresAt).getTime()
  return !Number.isFinite(expires) || expires <= now
}

/** Guest access: revoked and expired tokens are closed. Null expiry stays open. */
export function shareLinkGrantsAccess(link: ShareLinkAccess | null | undefined, now = Date.now()) {
  if (!link || link.revoked_at) return false
  return !shareLinkIsExpired(link.expires_at, now)
}
