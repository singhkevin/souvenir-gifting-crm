import { hostnameFromHostHeader, isLocalHostname } from '@/lib/local-origin'

type CookieWriteOptions = {
  path?: string
  sameSite?: 'lax' | 'strict' | 'none' | boolean
  httpOnly?: boolean
  maxAge?: number
  secure?: boolean
  domain?: string
  expires?: Date
}

/**
 * Host-only auth cookies. Browsers reject Domain=localhost, and a parent Domain
 * would share one session across the store, admin, and company hosts.
 * secure stays off on loopback so http://*.localhost can store the cookie.
 */
export function authCookieOptions(name: string, hostHeader?: string | null) {
  const options: {
    name: string
    path: '/'
    sameSite: 'lax'
    secure?: false
  } = {
    name,
    path: '/',
    sameSite: 'lax',
  }
  if (hostHeader && isLocalHostname(hostnameFromHostHeader(hostHeader))) {
    options.secure = false
  }
  return options
}

export function localCookieWriteOptions<T extends CookieWriteOptions | Record<string, unknown> | undefined>(
  options: T,
  hostHeader: string | null | undefined,
): T {
  if (!options || !hostHeader || !isLocalHostname(hostnameFromHostHeader(hostHeader))) return options
  const next = { ...options, secure: false } as T & { domain?: string }
  delete next.domain
  return next
}
