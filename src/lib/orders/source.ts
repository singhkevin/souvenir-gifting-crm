export const ORDER_SOURCES = ['store', 'business', 'portal', 'microsite', 'crm'] as const

export type OrderSource = (typeof ORDER_SOURCES)[number]

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  store: 'Store',
  business: 'Business',
  portal: 'Portal',
  microsite: 'Microsite',
  crm: 'CRM',
}

export function isOrderSource(value: string | null | undefined): value is OrderSource {
  return ORDER_SOURCES.includes(value as OrderSource)
}

/**
 * Mirrors place_direct_order. A service-role caller may set any allowlisted source.
 * A signed-in client may set portal or microsite. With no explicit source, a caller
 * without auth.uid() is store and a signed-in client is portal.
 */
export function resolveDirectOrderSource(input: {
  requested: string | null | undefined
  serviceRole: boolean
  signedIn: boolean
}): OrderSource | { error: string } {
  const requested = (input.requested || '').trim()
  if (requested) {
    if (!isOrderSource(requested)) return { error: 'Invalid order source' }
    if (!input.serviceRole && requested !== 'portal' && requested !== 'microsite') {
      return { error: 'Not permitted to set this order source' }
    }
    return requested
  }
  return input.signedIn ? 'portal' : 'store'
}
