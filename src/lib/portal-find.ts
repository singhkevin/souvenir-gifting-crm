import { parsePortalSlug } from '@/lib/portal-host'

export const PORTAL_FIND_LIMIT = 8
export const PORTAL_FIND_WINDOW_MS = 60_000

type Bucket = { count: number; reset: number }
const buckets = new Map<string, Bucket>()

export type PortalFindInput =
  | { kind: 'slug'; slug: string }
  | { kind: 'email' }
  | { kind: 'invalid' }

/** Exact company code, or a host/URL that is exactly `{slug}.{root}`. No prefix match. */
export function parsePortalFindInput(raw: string, root: string): PortalFindInput {
  let value = String(raw || '').trim().toLowerCase()
  if (!value || value.length > 200) return { kind: 'invalid' }
  if (value.includes('@') && !value.includes('/') && !value.includes(' ')) return { kind: 'email' }

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  value = value.split('/')[0]?.split('?')[0]?.split('#')[0] || ''
  value = value.replace(/:\d+$/, '').replace(/\.$/, '')
  if (!value) return { kind: 'invalid' }

  const portalRoot = root.trim().toLowerCase().replace(/\.$/, '')
  if (portalRoot && (value === portalRoot || value === `www.${portalRoot}`)) return { kind: 'invalid' }
  if (portalRoot && value.endsWith(`.${portalRoot}`)) {
    value = value.slice(0, -(portalRoot.length + 1))
    if (value.startsWith('www.')) value = value.slice(4)
  } else if (value.startsWith('www.')) {
    value = value.slice(4)
  }
  if (value.includes('.')) return { kind: 'invalid' }

  const parsed = parsePortalSlug(value)
  if (!parsed.slug) return { kind: 'invalid' }
  return { kind: 'slug', slug: parsed.slug }
}

export function checkPortalFindRate(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const id = key.trim() || 'unknown'
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.reset <= now) buckets.delete(bucketKey)
    }
  }
  const bucket = buckets.get(id)
  if (!bucket || bucket.reset <= now) {
    buckets.set(id, { count: 1, reset: now + PORTAL_FIND_WINDOW_MS })
    return { ok: true }
  }
  if (bucket.count >= PORTAL_FIND_LIMIT) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) }
  }
  bucket.count += 1
  return { ok: true }
}

export function resetPortalFindLimiter() {
  buckets.clear()
}
