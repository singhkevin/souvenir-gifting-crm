import { storeOrigin } from '@/lib/portal-host'

/**
 * Public store origin for sitemap.xml and robots.txt.
 * Production STORE_DOMAIN is the apex; those files advertise the www host.
 * Redirects keep storeOrigin() so existing host tests stay on the apex.
 */
export function storePublicOrigin(hostHeader: string | null | undefined) {
  const origin = storeOrigin(hostHeader)
  try {
    const url = new URL(origin)
    if (url.hostname === 'souvenirgifting.com') {
      url.hostname = 'www.souvenirgifting.com'
    }
    return url.origin
  } catch {
    return origin
  }
}
