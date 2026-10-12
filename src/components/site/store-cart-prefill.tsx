'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { addToCart } from '@/lib/catalogue/cart'

export function StoreCartPrefill({
  items,
  skipped,
}: {
  items: {
    id: string
    sku: string
    name: string
    price: number | null
    image_url: string | null
    quantity: number
    maxQuantity: number | null
  }[]
  skipped: string[]
}) {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    for (const item of items) {
      const result = addToCart(
        {
          id: item.id,
          sku: item.sku,
          name: item.name,
          price: item.price,
          image_url: item.image_url,
          maxQuantity: item.maxQuantity,
          surface: 'store',
        },
        item.quantity,
      )
      if (result.error) toast.error(result.error)
    }
    for (const message of skipped) toast.message(message)
    if (items.length) window.dispatchEvent(new Event('giffter-cart-open'))
  }, [items, skipped])

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-serif text-3xl">Store cart</h1>
      <p className="mt-3 text-sm text-[#5C6570]">
        {items.length
          ? `${items.length} item${items.length === 1 ? '' : 's'} added at the store price.`
          : 'Nothing from that link could be added to the store cart.'}
      </p>
      {skipped.map((message) => (
        <p key={message} className="mt-2 text-sm text-[#5C6570]">{message}</p>
      ))}
      <Link href="/catalogue" className="mt-6 inline-block text-sm font-semibold text-[#806A50]">
        Back to the catalogue
      </Link>
    </div>
  )
}
