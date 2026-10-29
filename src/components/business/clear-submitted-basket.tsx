'use client'

import { useEffect } from 'react'
import { writeCart } from '@/lib/catalogue/cart'
import { BUSINESS_QUOTE_KEY, BUSINESS_QUOTE_META_KEY } from '@/lib/business/lines'

/** After a successful submit, drop the local basket so the next request is a new one. */
export function ClearSubmittedBasket({ submitted }: { submitted: boolean }) {
  useEffect(() => {
    if (!submitted) return
    writeCart([], BUSINESS_QUOTE_KEY)
    try {
      localStorage.removeItem(BUSINESS_QUOTE_META_KEY)
    } catch {
      // The request is already saved. A leftover basket can be cleared from the quote page.
    }
  }, [submitted])
  return null
}
