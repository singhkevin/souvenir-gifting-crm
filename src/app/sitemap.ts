import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { publicSiteUrl } from '@/lib/brand'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { portalRootOrigin, resolveHost } from '@/lib/portal-host'
import { storePublicOrigin } from '@/lib/site/store-public-origin'

export const dynamic = 'force-dynamic'

const PUBLIC_PATHS = ['/', '/catalogue', '/categories', '/collections', '/about', '/request-quote']

function entries(origin: string, paths: string[]): MetadataRoute.Sitemap {
  return paths.map((path) => ({ url: new URL(path, origin).toString() }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
  if (!domainSplitEnabled()) return entries(publicSiteUrl(), PUBLIC_PATHS)

  const resolved = resolveHost(host)
  if (resolved.kind === 'portal-root') return entries(portalRootOrigin(host), ['/'])
  if (resolved.kind === 'admin' || resolved.kind === 'tenant') return []
  if (resolved.kind === 'store') return entries(storePublicOrigin(host), [...PUBLIC_PATHS, '/business'])
  return entries(publicSiteUrl(), PUBLIC_PATHS)
}
