import { accountKindForRole, type AccountKind } from '@/lib/account-kind'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { PORTAL_FIND_MESSAGE } from '@/lib/portal-find-message'

export { PORTAL_FIND_MESSAGE }
import {
  adminOrigin,
  isInternalApiPath,
  isPortalFindPath,
  isPortalPingPath,
  mainOrigin,
  portalLoginUrl,
  portalRootOrigin,
  storeOrigin,
  type ResolvedHost,
} from '@/lib/portal-host'

export type RouteDecision =
  | { action: 'continue' }
  | { action: 'redirect'; status: 301 | 302 | 307; location: string }
  | { action: 'not-found' }

export type HostLoginDecision =
  | { allow: true }
  | { allow: false; message: string; href: string; label: string }

const STAFF_MESSAGE = 'Staff accounts sign in on the admin site.'
const CLIENT_MESSAGE = 'This account signs in on your company portal.'
const CLIENT_PORTAL_MESSAGE = 'This account cannot sign in on this portal.'
const RETAIL_MESSAGE = 'Shop and business accounts sign in on the store.'

function matches(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

function isInfraPath(pathname: string) {
  return (
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/icons/') ||
    isPortalPingPath(pathname)
  )
}

/** Short CRM paths that next.config.ts rewrites onto /crm. */
const CRM_ALIAS_PREFIXES = [
  '/companies',
  '/contacts',
  '/leads',
  '/campaigns',
  '/requirements',
  '/products',
  '/mockups',
  '/quotations',
  '/orders',
  '/suppliers',
  '/printing-vendors',
  '/courier-partners',
  '/invoices',
  '/payments',
  '/receivables',
  '/reports',
  '/activities',
  '/team',
  '/settings',
  '/audit-log',
  '/my-work',
  '/department',
  '/order-management',
  '/order-control-center',
  '/payables',
  '/gst-reports',
]

function isCrmAlias(pathname: string) {
  return CRM_ALIAS_PREFIXES.some((base) => matches(pathname, base))
}

function isStaffPath(pathname: string) {
  return matches(pathname, '/crm') || matches(pathname, '/dashboard') || matches(pathname, '/share') || isCrmAlias(pathname)
}

function isAuthPath(pathname: string) {
  return (
    matches(pathname, '/login') ||
    matches(pathname, '/forgot-password') ||
    matches(pathname, '/reset-password') ||
    pathname === '/auth' ||
    pathname.startsWith('/auth/')
  )
}

function isStorePath(pathname: string) {
  return (
    pathname === '/' ||
    matches(pathname, '/home') ||
    matches(pathname, '/catalogue') ||
    matches(pathname, '/categories') ||
    matches(pathname, '/collections') ||
    matches(pathname, '/request-quote') ||
    matches(pathname, '/about') ||
    matches(pathname, '/business') ||
    matches(pathname, '/signup') ||
    isAuthPath(pathname)
  )
}

function absolute(origin: string, pathname: string, search = '') {
  const url = new URL(pathname || '/', origin)
  url.search = search
  return url.toString()
}

function hasAuthCallback(search: string) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return params.has('code') || params.has('token_hash') || params.get('type') === 'recovery'
}

function redirect(
  status: 301 | 302 | 307,
  origin: string,
  pathname: string,
  search = '',
): RouteDecision {
  return { action: 'redirect', status, location: absolute(origin, pathname, search) }
}

/**
 * Per-host allowlist. With DOMAIN_SPLIT off this always continues so the
 * existing proxy behavior is unchanged.
 */
export function decideHostRoute(host: ResolvedHost, pathname: string, search = ''): RouteDecision {
  if (!domainSplitEnabled()) return { action: 'continue' }
  if (host.kind === 'dev' || host.kind === 'main') return { action: 'continue' }
  if (isInfraPath(pathname)) return { action: 'continue' }

  if (host.kind === 'portal-root') {
    if (pathname === '/' || isPortalFindPath(pathname)) return { action: 'continue' }
    if (isInternalApiPath(pathname)) return { action: 'not-found' }
    if (matches(pathname, '/login')) {
      const url = new URL('/', portalRootOrigin(null))
      url.searchParams.set('notice', 'login')
      return { action: 'redirect', status: 302, location: url.toString() }
    }
    if (matches(pathname, '/portal')) {
      return redirect(302, portalRootOrigin(null), '/')
    }
    if (isStaffPath(pathname)) return redirect(301, adminOrigin(null), pathname, search)
    return redirect(301, storeOrigin(null), pathname, search)
  }

  if (host.kind === 'tenant') {
    if (isInternalApiPath(pathname)) return { action: 'not-found' }
    if (isStaffPath(pathname)) return redirect(301, adminOrigin(null), pathname, search)
    if (matches(pathname, '/business')) return redirect(301, storeOrigin(null), pathname, search)
    return { action: 'continue' }
  }

  if (host.kind === 'store') {
    if (pathname === '/api/internal/quotes/expire') return { action: 'continue' }
    if (isInternalApiPath(pathname)) return { action: 'not-found' }
    if (isStaffPath(pathname)) return redirect(301, adminOrigin(null), pathname, search)
    if (isStorePath(pathname)) return { action: 'continue' }
    return { action: 'not-found' }
  }

  if (host.kind === 'admin') {
    if (pathname === '/') {
      if (hasAuthCallback(search)) return { action: 'continue' }
      return redirect(302, adminOrigin(null), '/crm/dashboard')
    }
    if (isStaffPath(pathname) || isAuthPath(pathname) || isInternalApiPath(pathname)) {
      return { action: 'continue' }
    }
    if (isStorePath(pathname)) return redirect(301, storeOrigin(null), pathname, search)
    return { action: 'not-found' }
  }

  return { action: 'continue' }
}

/** HTTP robots tag for rendered responses. Null keeps today's default. */
export function robotsHeaderFor(host: ResolvedHost, pathname: string): string | null {
  if (!domainSplitEnabled()) return null
  if (host.kind === 'portal-root' && pathname === '/') return 'index, follow'
  if (host.kind === 'store' || host.kind === 'dev' || host.kind === 'main') return null
  return 'noindex, nofollow'
}

export function pendingPortalRedirect(hostHeader: string | null | undefined): { location: string; status: 307 } {
  if (domainSplitEnabled()) {
    return { location: absolute(portalRootOrigin(hostHeader), '/'), status: 307 }
  }
  return { location: absolute(mainOrigin(hostHeader), '/login'), status: 307 }
}

export function staffAreaRedirect(hostHeader: string | null | undefined, pathname: string, search: string) {
  const origin = domainSplitEnabled() ? adminOrigin(hostHeader) : mainOrigin(hostHeader)
  const status = domainSplitEnabled() ? 301 : 307
  return { location: absolute(origin, pathname, search), status: status as 301 | 307 }
}

/** Tenant /business goes to the store when the split is on, and to the main site when it is off. */
export function businessPortalRedirect(hostHeader: string | null | undefined, pathname: string, search: string) {
  const origin = domainSplitEnabled() ? storeOrigin(hostHeader) : mainOrigin(hostHeader)
  const status = domainSplitEnabled() ? 301 : 307
  return { location: absolute(origin, pathname, search), status: status as 301 | 307 }
}

function loginHref(kind: AccountKind, portalSlug: string | null) {
  if (kind === 'staff') return { href: `${adminOrigin(null)}/login`, label: 'Admin sign in' }
  if (kind === 'client') {
    const portal = portalLoginUrl(portalSlug)
    if (portal) return { href: portal, label: 'Company portal sign in' }
    return { href: `${portalRootOrigin(null)}/`, label: 'Find your company portal' }
  }
  return { href: `${storeOrigin(null)}/login`, label: 'Store sign in' }
}

export function hostLoginDecision(input: {
  host: ResolvedHost
  role: string | null | undefined
  companyId: string | null
  tenantCompanyId: string | null
  portalSlug: string | null
}): HostLoginDecision {
  if (!domainSplitEnabled()) return { allow: true }
  if (input.host.kind === 'dev' || input.host.kind === 'main') return { allow: true }

  const kind = accountKindForRole(input.role)
  const link = loginHref(kind, input.portalSlug)
  const deny = (message: string): HostLoginDecision => ({ allow: false, message, ...link })

  if (input.host.kind === 'admin') {
    if (kind === 'staff') return { allow: true }
    return deny(kind === 'client' ? CLIENT_MESSAGE : RETAIL_MESSAGE)
  }

  if (input.host.kind === 'store') {
    if (kind === 'retail') return { allow: true }
    return deny(kind === 'staff' ? STAFF_MESSAGE : CLIENT_MESSAGE)
  }

  if (input.host.kind === 'tenant') {
    if (kind !== 'client') return deny(kind === 'staff' ? STAFF_MESSAGE : RETAIL_MESSAGE)
    const matchesCompany = Boolean(
      input.companyId && input.tenantCompanyId && input.companyId === input.tenantCompanyId,
    )
    if (!matchesCompany) return deny(CLIENT_PORTAL_MESSAGE)
    return { allow: true }
  }

  return deny(kind === 'staff' ? STAFF_MESSAGE : kind === 'client' ? CLIENT_MESSAGE : RETAIL_MESSAGE)
}

export function confirmOriginForAccount(input: {
  role: string | null | undefined
  portalSlug: string | null | undefined
  fallbackOrigin: string
}) {
  if (!domainSplitEnabled()) return input.fallbackOrigin
  const kind = accountKindForRole(input.role)
  if (kind === 'staff') return adminOrigin(null)
  if (kind === 'client') {
    const portal = input.portalSlug ? portalLoginUrl(input.portalSlug) : null
    if (portal) return portal.replace(/\/login$/, '')
  }
  if (kind === 'retail') return storeOrigin(null)
  return input.fallbackOrigin
}

export function shareOriginForHost(host: ResolvedHost, requestOriginValue: string) {
  if (!domainSplitEnabled()) return requestOriginValue
  if (host.kind === 'dev' || host.kind === 'main') return requestOriginValue
  return adminOrigin(null)
}

export function finderDestinations() {
  const store = storeOrigin(null)
  return {
    store,
    business: `${store}/business`,
    adminLogin: `${adminOrigin(null)}/login`,
    finder: `${portalRootOrigin(null)}/`,
  }
}

export function portalFindResult(slug: string | null): { ok: true; message: string; redirectTo: string | null } {
  const redirectTo = slug ? portalLoginUrl(slug) : null
  return { ok: true, message: PORTAL_FIND_MESSAGE, redirectTo }
}
