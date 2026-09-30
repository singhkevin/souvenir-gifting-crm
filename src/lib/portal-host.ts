import { createAdminClient } from '@/lib/supabase/admin'

const RESERVED_SLUGS = new Set(['www', 'app', 'crm', 'api', 'admin', 'portal', 'mail'])

export function rootDomain(): string {
  return (process.env.ROOT_DOMAIN || '').trim().toLowerCase().replace(/\.$/, '')
}

/** Empty input clears the slug. Otherwise returns a single lowercase label. */
export function parsePortalSlug(raw: string | null | undefined): { slug: string | null; error?: string } {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return { slug: null }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return { slug: null, error: 'Portal address must use lowercase letters, numbers, and hyphens.' }
  }
  if (RESERVED_SLUGS.has(value)) {
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
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { kind: 'main' }
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

export async function companyIdForSlug(slug: string): Promise<string | null> {
  const admin = createAdminClient()
  if (!admin) return null
  const { data } = await admin
    .from('companies')
    .select('id')
    .eq('portal_slug', slug)
    .maybeSingle()
  return data?.id ?? null
}
