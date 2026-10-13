import 'server-only'

import { portalUrlForSlug } from '@/lib/portal-host'
import { clientQuotePath } from '@/lib/quotes/flow'
import { storePublicOrigin } from '@/lib/site/store-public-origin'

export function absoluteClientQuoteUrl(input: {
  accountType: string | null | undefined
  portalSlug: string | null | undefined
  quotationId: string
  origin: string
}) {
  const path = clientQuotePath(input.accountType, input.quotationId)
  if (input.accountType === 'business') return `${storePublicOrigin(null)}${path}`
  const portal = portalUrlForSlug(input.portalSlug)
  return `${portal || input.origin}${path}`
}
