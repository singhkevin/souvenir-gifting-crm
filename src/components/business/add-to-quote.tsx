'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { readCart, writeCart, type CartItem } from '@/lib/catalogue/cart'
import { BUSINESS_QUOTE_KEY, businessQuantityError, normaliseBreaks, targetPriceError } from '@/lib/business/lines'

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
    const line: CartItem = {
      id: product.id,
      sku: product.sku,
      name: product.name,
      price: product.indicativePrice,
      image_url: product.image_url,
      quantity,
      maxQuantity: null,
      surface: 'business',
      catalogId: null,
      moq: product.moqUnits,
      altQuantities,
      targetUnitPrice: targetValue,
      note,
    }
    const current = readCart(BUSINESS_QUOTE_KEY).filter((item) => item.id !== product.id)
    writeCart([...current, line], BUSINESS_QUOTE_KEY)
    setError(null)
    toast.success('Added to your quote basket')
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        Quantity (minimum {product.moqUnits})
        <input
          type="number"
          min={product.moqUnits}
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          className="mt-1 w-full rounded-md border border-[#E5DFD5] px-3 py-2"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm">Optional quantity breaks</legend>
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
            className="w-full rounded-md border border-[#E5DFD5] px-3 py-2 text-sm"
          />
        ))}
      </fieldset>
      <label className="block text-sm">
        Target unit price (optional)
        <input
          type="number"
          min="0"
          step="0.01"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          className="mt-1 w-full rounded-md border border-[#E5DFD5] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Note
        <textarea
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          className="mt-1 w-full rounded-md border border-[#E5DFD5] px-3 py-2"
          rows={3}
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        onClick={add}
        className="w-full bg-[#806A50] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
      >
        Add to quote
      </button>
      {product.buyOnStore ? (
        <Link
          href={`/catalogue/cart/add?items=${product.id}:${Math.max(1, Math.round(quantity) || 1)}`}
          className="block text-center text-sm text-[#806A50]"
        >
          Buy on store
        </Link>
      ) : null}
    </div>
  )
}
