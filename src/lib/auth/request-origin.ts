import { headers } from 'next/headers'
import { originFromForwarded } from '@/lib/auth/public-origin'
import { shareOriginForHost } from '@/lib/domain-routing'
import { resolveHost } from '@/lib/portal-host'

export async function requestOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  return originFromForwarded(host, h.get('x-forwarded-proto'))
}

export async function recoveryRedirectTo() {
  return `${await requestOrigin()}/auth/confirm`
}

/** Share links stay on the request host until the split is on, then they use the admin host. */
export async function shareLinkOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  return shareOriginForHost(resolveHost(host), await requestOrigin())
}
