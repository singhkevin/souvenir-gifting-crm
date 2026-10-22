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
      className="inline-flex items-center gap-2 border border-[#9E4300] bg-transparent px-4 py-2.5 sv2-label text-xs text-[#9E4300] hover:bg-[#9E4300] hover:text-white transition-colors rounded-none"
    >
      Request a new quote with these items
    </button>
  )
}

