import { AUTH_COOKIE_PREFIX, RECOVERY_COOKIE_NAME, isPublicSitePath } from '@/lib/auth/tab'

export const SESSION_HEADER = 'x-giffter-session'

type CookieLike = { name: string; value: string }

/** True when this request is carrying a tab auth cookie, not the recovery cookie. */
export function hasAuthSessionCookie(cookies: CookieLike[]) {
  return cookies.some((cookie) => {
    if (!cookie.value) return false
    if (cookie.name === RECOVERY_COOKIE_NAME || cookie.name.includes('recovery')) return false
    return cookie.name.startsWith(AUTH_COOKIE_PREFIX)
  })
}

export function sessionHintFromHeaders(get: (name: string) => string | null) {
  return get(SESSION_HEADER) === '1' || get(`x-middleware-request-${SESSION_HEADER}`) === '1'
}

/**
 * Store, admin and portal-root catalogue pages do not use the proxy session.
 * Tenant hosts still do: the proxy decides whether that company user may enter.
 */
export function publicReadSkipsSession(hostKind: string, pathname: string) {
  return hostKind !== 'tenant' && isPublicSitePath(pathname)
}
