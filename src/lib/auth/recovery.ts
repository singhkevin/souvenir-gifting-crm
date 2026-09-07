import { TAB_QUERY } from '@/lib/auth/tab'

const RECOVERY_QUERY_KEYS = ['code', 'token_hash', 'type'] as const

export function hasRecoveryQuery(search: URLSearchParams) {
  const type = search.get('type')
  if (type === 'recovery' || search.has('token_hash')) return true
  if (search.has('code') && type !== 'signup' && type !== 'email' && type !== 'magiclink') {
    return true
  }
  return false
}

export function hasRecoveryHash(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (params.get('type') === 'recovery' && (params.has('access_token') || params.has('refresh_token'))) {
    return true
  }
  return params.has('access_token') && params.has('refresh_token')
}

/** Query-token recovery must be exchanged once at /auth/confirm. Hash tokens stay on /reset-password. */
export function recoveryClientDestination(href: string) {
  const url = new URL(href)
  if (hasRecoveryHash(url.hash)) {
    const next = new URL('/reset-password', url.origin)
    url.searchParams.forEach((value, key) => {
      if (key !== TAB_QUERY) next.searchParams.set(key, value)
    })
    next.hash = url.hash
    return `${next.pathname}${next.search}${next.hash}`
  }
  if (!hasRecoveryQuery(url.searchParams)) return null
  const path = url.pathname.replace(/\/$/, '') || '/'
  if (path === '/auth/confirm' || path.startsWith('/auth/confirm/')) return null
  const next = new URL('/auth/confirm', url.origin)
  for (const key of RECOVERY_QUERY_KEYS) {
    const value = url.searchParams.get(key)
    if (value) next.searchParams.set(key, value)
  }
  return `${next.pathname}${next.search}`
}

export function confirmSearchFromParams(params: {
  code?: string
  type?: string
  token_hash?: string
}) {
  const dest = new URLSearchParams()
  if (params.code) dest.set('code', params.code)
  if (params.token_hash) dest.set('token_hash', params.token_hash)
  if (params.type) dest.set('type', params.type)
  return dest.toString()
}
