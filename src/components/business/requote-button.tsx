'use client'

import { useRouter } from 'next/navigation'
import { writeCart, type CartItem } from '@/lib/catalogue/cart'
import { BUSINESS_QUOTE_KEY } from '@/lib/business/lines'

export function RequoteButton({ lines }: { lines: CartItem[] }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        writeCart(lines, BUSINESS_QUOTE_KEY)
        router.push('/business/quote')
      }}
      className="text-sm font-semibold text-[#806A50]"
    >
      Request a new quote with these items
    </button>
  )
}
