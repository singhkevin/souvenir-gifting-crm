'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { readCart, writeCart } from '@/lib/catalogue/cart'
import { BUSINESS_QUOTE_KEY, businessQuantityError, minimumOrderQty } from '@/lib/business/lines'
import { businessQuoteLine, upsertBusinessQuoteLine } from '@/lib/business/quote-cart'

export function AddToQuoteButton({
  product,
}: {
  product: {
    id: string
    sku: string
    name: string
    image_url: string | null
    price: number | null
    moq: number | null
  }
}) {
  const moq = minimumOrderQty(product.moq)
  const [quantity, setQuantity] = useState(moq)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const qtyError = businessQuantityError(quantity, moq)
    if (qtyError) {
      setError(qtyError)
      return
    }
    const line = businessQuoteLine({
      id: product.id,
      sku: product.sku,
      name: product.name,
      image_url: product.image_url,
      price: product.price,
      quantity,
      moq,
      note,
    })
    writeCart(upsertBusinessQuoteLine(readCart(BUSINESS_QUOTE_KEY), line), BUSINESS_QUOTE_KEY)
    setError(null)
    toast.success('Added to your quote basket')
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={`quote-qty-${product.id}`}>
          Quantity for {product.name}
        </label>
        <input
          id={`quote-qty-${product.id}`}
          type="number"
          min={moq}
          value={quantity}
          aria-label={`Quantity for ${product.name}, minimum ${moq}`}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="w-14 border border-[#CCC5BD] bg-[#FCF9F2] px-1.5 py-2 sv2-mono-sm text-xs text-[#1C1C18] focus:border-[#1C1C18] focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="min-w-0 flex-1 border border-[#000000] bg-[#000000] px-2 py-2 text-center sv2-label text-[10px] tracking-wider text-white transition-colors hover:border-[#9E4300] hover:bg-[#9E4300]"
        >
          Add to quote
        </button>
      </div>
      <label className="sr-only" htmlFor={`quote-note-${product.id}`}>
        Branding or variant note for {product.name}
      </label>
      <input
        id={`quote-note-${product.id}`}
        value={note}
        maxLength={500}
        placeholder="Branding or variant note"
        aria-label={`Branding or variant note for ${product.name}`}
        onChange={(event) => setNote(event.target.value)}
        className="w-full border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-1.5 text-[11px] text-[#1C1C18] placeholder:text-[#7C766F] focus:border-[#1C1C18] focus:outline-none"
      />
      {error ? <p className="text-[10px] leading-snug text-[#BA1A1A]">{error}</p> : null}
    </div>
  )
}
