'use client'

import { useEffect, useState } from 'react'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { retailAvailability } from '@/lib/catalogue/storefront'
import type { PurchaseOffer } from '@/lib/catalogue/purchase-path'

const NOTIFY_KEY = 'gf-stock-notify'

type RetailProduct = {
  id: string
  sku: string
  name: string
  price: number | null
  image_url: string | null
  purchase: PurchaseOffer
}

function readNotified(productId: string) {
  try {
    const raw = window.localStorage.getItem(NOTIFY_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) && list.some((row) => row && row.id === productId)
  } catch {
    return false
  }
}

export function RetailOutOfStock({
  productId,
  name,
  compact = false,
}: {
  productId: string
  name: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSaved(readNotified(productId))
  }, [productId])

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const next = email.trim().toLowerCase()
    if (!next.includes('@') || !next.includes('.')) {
      setError('Enter an email address.')
      return
    }
    try {
      const raw = window.localStorage.getItem(NOTIFY_KEY)
      const list = raw ? JSON.parse(raw) : []
      const rows = Array.isArray(list) ? list.filter((row) => row && row.id !== productId) : []
      rows.push({ id: productId, email: next, name })
      window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(rows.slice(-40)))
    } catch {
      setError('Could not save that on this device.')
      return
    }
    setError(null)
    setSaved(true)
  }

  return (
    <div className={compact ? 'space-y-1 text-center' : 'space-y-2'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#715a3e]">Out of stock</p>
      {saved ? (
        <p className="text-[11px] leading-4 text-[#4d453e]">You&apos;re on the list for this gift.</p>
      ) : open ? (
        <form onSubmit={save} className="flex flex-col gap-1.5">
          <label className="sr-only" htmlFor={`notify-${productId}`}>
            Email for {name}
          </label>
          <input
            id={`notify-${productId}`}
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full rounded-md border border-[#eadfd4] px-2 py-1.5 text-xs text-[#22180b] outline-none focus:border-[#715a3e]"
          />
          <button
            type="submit"
            className="rounded-md bg-[#22180b] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#382c1e]"
          >
            Notify me
          </button>
          {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] font-semibold text-[#735c00] underline decoration-[#c4a35a] underline-offset-2"
        >
          Notify me
        </button>
      )}
    </div>
  )
}

export function RetailBuyActions({
  product,
  layout = 'split',
}: {
  product: RetailProduct
  layout?: 'split' | 'row'
}) {
  const state = retailAvailability(product.purchase)
  const draft = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    image_url: product.image_url,
  }
  const maxQuantity = product.purchase.maxBuyQty

  if (state === 'buy') {
    return (
      <div className={layout === 'row' ? 'flex flex-col gap-3 sm:flex-row sm:items-center' : 'grid grid-cols-2 gap-1.5'}>
        <AddToCartButton
          label="Add to cart"
          maxQuantity={maxQuantity}
          product={draft}
          className={
            layout === 'row'
              ? 'inline-flex justify-center border border-[#E5DFD5] px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#806A50] hover:bg-[#FAF7F2] sm:py-3'
              : 'rounded-md border border-[#eadfd4] bg-[#fbf6f0] px-2 py-1.5 text-center text-[11px] font-semibold text-[#22180b] hover:bg-[#f6efe6]'
          }
        />
        <AddToCartButton
          label="Buy now"
          openCart
          maxQuantity={maxQuantity}
          product={draft}
          className={
            layout === 'row'
              ? 'inline-flex justify-center bg-[#806A50] px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#9C8567] sm:py-3'
              : 'rounded-md bg-[#22180b] px-2 py-1.5 text-center text-[11px] font-semibold text-white hover:bg-[#382c1e]'
          }
        />
      </div>
    )
  }

  if (state === 'sample') {
    return <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#715a3e]">Sample only</p>
  }

  if (state === 'out') {
    return <RetailOutOfStock productId={product.id} name={product.name} compact={layout === 'split'} />
  }

  return <p className="text-[11px] font-semibold text-[#715a3e]">Not available to buy</p>
}
