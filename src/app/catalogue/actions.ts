'use server'

import { placeStoreDirectOrder } from '@/lib/catalogue/direct-order'
import type { CheckoutLineInput } from '@/lib/catalogue/purchase-path'

export async function checkoutStoreCart(input: {
  fullName?: string
  email?: string
  companyName?: string
  phone?: string
  fax?: string
  lines: CheckoutLineInput[]
}) {
  return placeStoreDirectOrder(input)
}
