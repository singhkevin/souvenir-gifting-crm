'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, Check, Minus, Plus, X } from 'lucide-react'
import { addToCart, type CartItem } from '@/lib/catalogue/cart'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'

export function AddToCartButton({
  product,
  className,
  compact = false,
}: {
  product: Omit<CartItem, 'quantity'>
  className: string
  /** Icon-only, for overlaying on a product card. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const confirmAdd = () => {
    addToCart(product, qty)
    setOpen(false)
    setQty(1)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }

  return (
    <>
      <button
        type="button"
        aria-label={compact ? (added ? 'Added to cart' : 'Add to cart') : undefined}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setQty(1)
          setOpen(true)
        }}
        className={className}
      >
        {compact ? (
          added ? (
            <Check size={14} />
          ) : (
            <ShoppingBag size={14} />
          )
        ) : added ? (
          <span className="inline-flex items-center gap-2">
            <Check size={14} /> Added
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <ShoppingBag size={14} /> Add to cart
          </span>
        )}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/45"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-xs rounded-md bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setOpen(false)
              }}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#F6F4F1] text-[#5C6570] hover:bg-[#EFE9E0]"
            >
              <X size={14} />
            </button>

            <div className="flex items-center gap-3 pr-6">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md catalogue-studio-field">
                <ProductImage
                  src={product.image_url}
                  alt={product.name}
                  size="sm"
                  fit="contain"
                  className="h-full w-full bg-transparent"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-[#1B2430]">{product.name}</p>
                {product.price != null ? (
                  <p className="mt-0.5 text-xs font-semibold text-[#806A50]">{formatCurrency(product.price)}</p>
                ) : null}
              </div>
            </div>

            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5C6570]">Quantity</p>
            <div className="mt-2 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setQty((value) => Math.max(1, value - 1))
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5DFD5] text-[#5C6570] hover:bg-[#FAF7F2]"
              >
                <Minus size={14} />
              </button>
              <span className="w-10 text-center text-lg text-[#1B2430]">{qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setQty((value) => value + 1)
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5DFD5] text-[#5C6570] hover:bg-[#FAF7F2]"
              >
                <Plus size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                confirmAdd()
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 bg-[#806A50] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white hover:bg-[#9C8567]"
            >
              <ShoppingBag size={14} /> Add {qty} to cart
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
