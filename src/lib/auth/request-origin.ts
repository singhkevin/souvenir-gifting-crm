import { headers } from 'next/headers'

export async function requestOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (!host) return 'http://localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function recoveryRedirectTo() {
  return `${await requestOrigin()}/auth/confirm`
}
