'use server'

import { placeStoreDirectOrder } from '@/lib/catalogue/direct-order'
import { withIdempotency } from '@/lib/idempotency'
import type { CheckoutLineInput } from '@/lib/catalogue/purchase-path'

export async function checkoutStoreCart(input: {
  fullName?: string
  email?: string
  companyName?: string
  phone?: string
  fax?: string
  lines: CheckoutLineInput[]
  idempotencyKey?: string
}) {
  const { idempotencyKey, ...order } = input
  return withIdempotency('store.checkout', idempotencyKey, () => placeStoreDirectOrder(order))
}
