import { headers } from 'next/headers'
import { TAB_HEADER, TAB_URL_HEADER, isTabId, tabIdFromUrlLike } from '@/lib/auth/tab'

export async function getRequestTabId() {
  const h = await headers()
  const headerTab = h.get(TAB_HEADER) || h.get(`x-middleware-request-${TAB_HEADER}`)
  if (isTabId(headerTab)) return headerTab

  for (const raw of [
    h.get(TAB_URL_HEADER),
    h.get(`x-middleware-request-${TAB_URL_HEADER}`),
    h.get('next-url'),
    h.get('x-url'),
    h.get('referer'),
  ]) {
    const queryTab = tabIdFromUrlLike(raw)
    if (queryTab) return queryTab
  }

  return null
}
