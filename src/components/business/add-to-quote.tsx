'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { readCart, writeCart } from '@/lib/catalogue/cart'
import { BUSINESS_QUOTE_KEY, businessQuantityError, normaliseBreaks, targetPriceError } from '@/lib/business/lines'
import { businessQuoteLine, upsertBusinessQuoteLine } from '@/lib/business/quote-cart'

export function AddToQuote({
  product,
}: {
  product: {
    id: string
    sku: string
    name: string
    image_url: string | null
    indicativePrice: number | null
    moqUnits: number
    buyOnStore: boolean
  }
}) {
  const [quantity, setQuantity] = useState(product.moqUnits)
  const [breaks, setBreaks] = useState(['', '', ''])
  const [note, setNote] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const qtyError = businessQuantityError(quantity, product.moqUnits)
    if (qtyError) {
      setError(qtyError)
      return
    }
    const targetValue = target.trim() === '' ? null : Number(target)
    const priceError = targetPriceError(targetValue)
    if (priceError) {
      setError(priceError)
      return
    }
    const altQuantities = normaliseBreaks(
      product.moqUnits,
      quantity,
      breaks.map((value) => Number(value)).filter((value) => Number.isFinite(value)),
    )
    const line = businessQuoteLine({
      id: product.id,
      sku: product.sku,
      name: product.name,
      price: product.indicativePrice,
      image_url: product.image_url,
      quantity,
      moq: product.moqUnits,
      altQuantities,
      targetUnitPrice: targetValue,
      note,
    })
    writeCart(upsertBusinessQuoteLine(readCart(BUSINESS_QUOTE_KEY), line), BUSINESS_QUOTE_KEY)
    setError(null)
    toast.success('Added to your quote basket')
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sv2-label text-[10px] text-[#4A4640]">
          Quantity (minimum <span className="sv2-mono-sm">{product.moqUnits}</span>)
        </span>
        <input
          type="number"
          min={product.moqUnits}
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="mt-1 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 sv2-mono-sm text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
        />
      </label>
      <fieldset className="border border-[#CCC5BD] bg-[#F6F3EC] p-3 rounded-none space-y-2">
        <legend className="px-1 sv2-label text-[10px] text-[#4A4640]">Optional quantity breaks</legend>
        {breaks.map((value, index) => (
          <input
            key={index}
            type="number"
            min={product.moqUnits}
            value={value}
            placeholder={`Break ${index + 1}`}
            onChange={(event) => {
              const next = [...breaks]
              next[index] = event.target.value
              setBreaks(next)
            }}
            className="w-full border border-[#CCC5BD] bg-[#FCF9F2] px-3 py-2 sv2-mono-sm text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
          />
        ))}
      </fieldset>
      <label className="block">
        <span className="sv2-label text-[10px] text-[#4A4640]">Target unit price (optional)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="mt-1 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 sv2-mono-sm text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="sv2-label text-[10px] text-[#4A4640]">Branding or variant note</span>
        <textarea
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          className="mt-1 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
          rows={3}
        />
      </label>
      {error ? (
        <div className="border border-[#BA1A1A] bg-[#FFDAD6]/30 p-2 text-xs text-[#BA1A1A]">
          {error}
        </div>
      ) : null}
      <button
        type="button"
        onClick={add}
        className="w-full bg-[#9E4300] px-4 py-3 sv2-label text-xs text-white hover:bg-[#783100] transition-colors rounded-none"
      >
        Add to quote
      </button>
      {product.buyOnStore ? (
        <Link
          href={`/catalogue/cart/add?items=${product.id}:${Math.max(1, Math.round(quantity) || 1)}`}
          className="block text-center sv2-label text-[11px] text-[#9E4300] hover:underline"
        >
          Buy on store
        </Link>
      ) : null}
    </div>
  )
}
