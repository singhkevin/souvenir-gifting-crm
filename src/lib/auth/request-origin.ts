import { headers } from 'next/headers'
import { originFromForwarded } from '@/lib/auth/public-origin'

export async function requestOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  return originFromForwarded(host, h.get('x-forwarded-proto'))
}

export async function recoveryRedirectTo() {
  return `${await requestOrigin()}/auth/confirm`
}
