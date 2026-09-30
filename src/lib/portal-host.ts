import { createAdminClient } from '@/lib/supabase/admin'

/** Request headers set by proxy after tenant resolution. Never trust inbound copies. */
export const TENANT_ID_HEADER = 'x-tenant-id'
export const TENANT_STATUS_HEADER = 'x-tenant-status'
export const TENANT_TRIAL_ENDS_HEADER = 'x-tenant-trial-ends-at'

const RESERVED_SLUGS = new Set([
  'www',
  'mail',
  'ftp',
  'webmail',
  'cpanel',
  'autodiscover',
  'smtp',
  'pop',
  'imap',
  'ns1',
  'ns2',
  'ns3',
  'cdn',
  'static',
  'assets',
  'media',
  'img',
  'images',
  'api',
  'admin',
  'app',
  'apps',
  'portal',
  'status',
  'help',
  'support',
  'billing',
  'login',
  'logout',
  'signup',
  'signin',
  'signout',
  'register',
  'auth',
  'oauth',
  'sso',
  'dev',
  'staging',
  'stage',
  'test',
  'testing',
  'demo',
  'docs',
  'blog',
  'crm',
  'dashboard',
  'home',
  'www2',
  'm',
  'mobile',
  'email',
  'mx',
  'vpn',
  'git',
  'gitlab',
  'github',
  'ci',
  'cdn2',
  'files',
  'download',
  'downloads',
  'shop',
  'store',
  'secure',
  'ssl',
  'ftp2',
  'sftp',
  'ssh',
  'root',
  'null',
  'undefined',
  'localhost',
  'local',
  'internal',
  'intranet',
  'corp',
  'corporate',
  'ops',
  'operations',
  'finance',
  'hr',
  'it',
  'webmaster',
  'postmaster',
  'abuse',
  'noreply',
  'no-reply',
  'webmaster',
  'hostmaster',
  'phpmyadmin',
  'whm',
  'webdisk',
  'cpcalendars',
  'cpcontacts',
])

/** Brand + common blocked terms for portal host labels. */
const DENYLIST_SLUGS = new Set([
  'souvenir',
  'souvenirs',
  'giftingstore',
  'gifting-store',
  'giffter',
  'official',
  'brand',
  'superadmin',
  'super-admin',
  'administrator',
  'sysadmin',
  'fuck',
  'fucking',
  'shit',
  'asshole',
  'bitch',
  'bastard',
  'cunt',
  'dick',
  'piss',
  'slut',
  'whore',
  'nigger',
  'nigga',
  'faggot',
  'retard',
])

const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/
const MIN_SLUG_LEN = 3
const MAX_SLUG_LEN = 40

const CACHE_HIT_TTL_MS = 60_000
const CACHE_MISS_TTL_MS = 30_000

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled'

export type ResolvedTenant = {
  id: string
  status: TenantStatus
  trial_ends_at: string | null
}

type CacheEntry =
  | { kind: 'hit'; tenant: ResolvedTenant; expiresAt: number }
  | { kind: 'miss'; expiresAt: number }

const tenantCache = new Map<string, CacheEntry>()

export function rootDomain(): string {
  return (process.env.ROOT_DOMAIN || '').trim().toLowerCase().replace(/\.$/, '')
}

/** Empty input clears the slug. Otherwise returns a single lowercase label. */
export function parsePortalSlug(raw: string | null | undefined): { slug: string | null; error?: string } {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return { slug: null }
  if (value.length < MIN_SLUG_LEN || value.length > MAX_SLUG_LEN) {
    return { slug: null, error: `Portal address must be ${MIN_SLUG_LEN}–${MAX_SLUG_LEN} characters.` }
  }
  if (!SLUG_RE.test(value)) {
    return {
      slug: null,
      error: 'Portal address must use lowercase letters, numbers, and hyphens (no leading or trailing hyphen).',
    }
  }
  if (RESERVED_SLUGS.has(value) || DENYLIST_SLUGS.has(value)) {
    return { slug: null, error: 'That portal address is reserved.' }
  }
  return { slug: value }
}

export function portalUrlForSlug(slug: string | null | undefined): string | null {
  const root = rootDomain()
  if (!root || !slug) return null
  const proto = root === 'localhost' ? 'http' : 'https'
  return `${proto}://${slug}.${root}`
}

type HostParts = { hostname: string; port: string }

function hostParts(hostHeader: string | null | undefined): HostParts {
  const host = (hostHeader || '').split(',')[0].trim().toLowerCase()
  const match = host.match(/:(\d+)$/)
  const hostname = match ? host.slice(0, -match[0].length) : host
  return { hostname, port: match?.[1] || '' }
}

export type ResolvedHost =
  | { kind: 'main' }
  | { kind: 'tenant'; slug: string }

export function resolveHost(hostHeader: string | null | undefined): ResolvedHost {
  const { hostname } = hostParts(hostHeader)
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.vercel.app')) return { kind: 'main' }
  const root = rootDomain()
  if (!root) return { kind: 'main' }
  if (hostname === root || hostname === `www.${root}`) return { kind: 'main' }
  const suffix = `.${root}`
  if (!hostname.endsWith(suffix)) return { kind: 'main' }
  const slug = hostname.slice(0, -suffix.length)
  if (!SLUG_RE.test(slug) || slug.length < MIN_SLUG_LEN || slug.length > MAX_SLUG_LEN) return { kind: 'main' }
  return { kind: 'tenant', slug }
}

function originForHostname(hostname: string, port: string) {
  const proto = hostname === 'localhost' || hostname.endsWith('.localhost') ? 'http' : 'https'
  const withPort = port && proto === 'http' ? `:${port}` : ''
  return `${proto}://${hostname}${withPort}`
}

/** Apex for this deployment, preserving a localhost port. */
export function mainOrigin(hostHeader: string | null | undefined): string {
  const { port } = hostParts(hostHeader)
  const root = rootDomain()
  if (!root || root.endsWith('.vercel.app')) {
    const { hostname } = hostParts(hostHeader)
    return originForHostname(hostname || 'localhost', port)
  }
  return originForHostname(root, port)
}

/** Absolute portal URL on the company host. Null when ROOT_DOMAIN is unset. */
export function tenantPortalUrl(slug: string, hostHeader: string | null | undefined): string | null {
  const root = rootDomain()
  if (!root || !slug) return null
  const { port } = hostParts(hostHeader)
  return `${originForHostname(`${slug}.${root}`, port)}/portal`
}

export function isTenantAuthPath(pathname: string) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/forgot-password' ||
    pathname.startsWith('/forgot-password/') ||
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname === '/auth/confirm' ||
    pathname.startsWith('/auth/confirm/')
  )
}

export function isTenantGatePath(pathname: string) {
  return (
    pathname === '/tenant/not-found' ||
    pathname.startsWith('/tenant/not-found/') ||
    pathname === '/tenant/suspended' ||
    pathname.startsWith('/tenant/suspended/') ||
    pathname === '/tenant/trial-expired' ||
    pathname.startsWith('/tenant/trial-expired/')
  )
}

function normalizeStatus(raw: string | null | undefined): TenantStatus | null {
  if (raw === 'trial' || raw === 'active' || raw === 'suspended' || raw === 'cancelled') return raw
  return null
}

export function isTrialExpired(tenant: Pick<ResolvedTenant, 'status' | 'trial_ends_at'>, now = Date.now()): boolean {
  if (tenant.status !== 'trial') return false
  if (!tenant.trial_ends_at) return false
  const ends = Date.parse(tenant.trial_ends_at)
  return Number.isFinite(ends) && ends < now
}

async function fetchTenantBySlug(slug: string): Promise<ResolvedTenant | null> {
  const admin = createAdminClient()
  if (!admin) return null
  const { data } = await admin
    .from('companies')
    .select('id, portal_status, trial_ends_at')
    .eq('portal_slug', slug)
    .maybeSingle()
  if (!data?.id) return null
  const status = normalizeStatus(data.portal_status) || 'active'
  return {
    id: data.id,
    status,
    trial_ends_at: data.trial_ends_at ?? null,
  }
}

/** Cached tenant lookup (~60s hit / ~30s miss). Used by proxy once per request. */
export async function resolveTenantBySlug(slug: string): Promise<ResolvedTenant | null> {
  const key = slug.toLowerCase()
  const now = Date.now()
  const cached = tenantCache.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.kind === 'hit' ? cached.tenant : null
  }

  const tenant = await fetchTenantBySlug(key)
  if (tenant) {
    tenantCache.set(key, { kind: 'hit', tenant, expiresAt: now + CACHE_HIT_TTL_MS })
    return tenant
  }
  tenantCache.set(key, { kind: 'miss', expiresAt: now + CACHE_MISS_TTL_MS })
  return null
}

/** @deprecated Prefer resolveTenantBySlug; kept for any stragglers. */
export async function companyIdForSlug(slug: string): Promise<string | null> {
  const tenant = await resolveTenantBySlug(slug)
  return tenant?.id ?? null
}

export function stripInboundTenantHeaders(headers: Headers) {
  headers.delete(TENANT_ID_HEADER)
  headers.delete(TENANT_STATUS_HEADER)
  headers.delete(TENANT_TRIAL_ENDS_HEADER)
  headers.delete(`x-middleware-request-${TENANT_ID_HEADER}`)
  headers.delete(`x-middleware-request-${TENANT_STATUS_HEADER}`)
  headers.delete(`x-middleware-request-${TENANT_TRIAL_ENDS_HEADER}`)
}

export function applyTenantHeaders(headers: Headers, tenant: ResolvedTenant | null) {
  stripInboundTenantHeaders(headers)
  if (!tenant) return
  headers.set(TENANT_ID_HEADER, tenant.id)
  headers.set(TENANT_STATUS_HEADER, tenant.status)
  if (tenant.trial_ends_at) headers.set(TENANT_TRIAL_ENDS_HEADER, tenant.trial_ends_at)
}

type HeaderReader = { get(name: string): string | null }

export function readTenantFromHeaders(headerStore: HeaderReader): ResolvedTenant | null {
  const id =
    headerStore.get(TENANT_ID_HEADER) ||
    headerStore.get(`x-middleware-request-${TENANT_ID_HEADER}`)
  if (!id) return null
  const statusRaw =
    headerStore.get(TENANT_STATUS_HEADER) ||
    headerStore.get(`x-middleware-request-${TENANT_STATUS_HEADER}`)
  const status = normalizeStatus(statusRaw) || 'active'
  const trial_ends_at =
    headerStore.get(TENANT_TRIAL_ENDS_HEADER) ||
    headerStore.get(`x-middleware-request-${TENANT_TRIAL_ENDS_HEADER}`) ||
    null
  return { id, status, trial_ends_at }
}

/** True when slug is still reserved in slug_history (released_at null or within 30 days). */
export async function isSlugReservedInHistory(slug: string): Promise<boolean> {
  const admin = createAdminClient()
  if (!admin) return false
  const { data } = await admin
    .from('slug_history')
    .select('slug, released_at')
    .eq('slug', slug)
    .maybeSingle()
  if (!data) return false
  if (!data.released_at) return true
  const released = Date.parse(data.released_at)
  if (!Number.isFinite(released)) return true
  const graceMs = 30 * 24 * 60 * 60 * 1000
  return released + graceMs > Date.now()
}
