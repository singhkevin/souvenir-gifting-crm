import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { portalRootOrigin, resolveHost, storeOrigin } from '@/lib/portal-host'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
  if (!domainSplitEnabled()) {
    return { rules: { userAgent: '*', allow: '/' } }
  }

  const resolved = resolveHost(host)
  if (resolved.kind === 'store') {
    return {
      rules: { userAgent: '*', allow: '/', disallow: ['/login', '/signup', '/api/'] },
      sitemap: `${storeOrigin(host)}/sitemap.xml`,
    }
  }
  if (resolved.kind === 'portal-root') {
    return {
      rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
      sitemap: `${portalRootOrigin(host)}/sitemap.xml`,
    }
  }
  return { rules: { userAgent: '*', disallow: '/' } }
}
