'use server'

import { placeQuoteOrder } from '@/lib/business/quote-checkout'
import { checkoutRetailCart } from '@/lib/catalogue/retail-checkout'
import type { CheckoutLineInput } from '@/lib/catalogue/purchase-path'
import { withIdempotency } from '@/lib/idempotency'

export async function checkoutStoreCart(input: {
  fullName?: string
  email?: string
  companyName?: string
  phone?: string
  fax?: string
  lines: CheckoutLineInput[]
  neededBy?: string
  note?: string
  notifyStock?: boolean
  idempotencyKey?: string
}) {
  const { idempotencyKey, ...order } = input
  return withIdempotency('store.checkout', idempotencyKey, () => checkoutRetailCart(order))
}

export async function checkoutQuotedOrder(input: {
  token: string
  fullName?: string
  email?: string
  phone?: string
  idempotencyKey?: string
}) {
  const { idempotencyKey, ...order } = input
  return withIdempotency('store.quoteCheckout', idempotencyKey, () => placeQuoteOrder(order))
}
