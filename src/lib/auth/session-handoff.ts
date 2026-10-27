import { RECOVERY_COOKIE_NAME, authCookieName, isTabId } from '@/lib/auth/tab'

/** Session cookie or a chunk of it (`gf-auth-recovery` or `gf-auth-recovery.0`). */
export function isRecoverySessionCookie(name: string) {
  if (name === RECOVERY_COOKIE_NAME) return true
  const marker = `${RECOVERY_COOKIE_NAME}.`
  if (!name.startsWith(marker)) return false
  return /^(0|[1-9][0-9]*)$/.test(name.slice(marker.length))
}

/** Recovery session cookies plus PKCE verifier cookies that share the recovery storage key. */
export function isRecoveryAuthCookie(name: string) {
  return isRecoverySessionCookie(name) || name.startsWith(`${RECOVERY_COOKIE_NAME}-`)
}

/** Rename a recovery session cookie onto this tab. Verifier cookies are not renamed. */
export function sessionCookieNameFromRecovery(name: string, tabId: string) {
  if (!isTabId(tabId) || !isRecoverySessionCookie(name)) return null
  if (name === RECOVERY_COOKIE_NAME) return authCookieName(tabId)
  const suffix = name.slice(RECOVERY_COOKIE_NAME.length)
  return `${authCookieName(tabId)}${suffix}`
}
