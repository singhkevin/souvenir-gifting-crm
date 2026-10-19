'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ShoppingBag, Check, Minus, Plus, X } from 'lucide-react'
import {
  addToCart,
  STORE_CART_KEY,
  type CartDraft,
  type CartSurface,
} from '@/lib/catalogue/cart'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'

export function AddToCartButton({
  product,
  className,
  compact = false,
  cartKey = STORE_CART_KEY,
  maxQuantity = null,
  surface = 'store',
  catalogId = null,
  label = 'Add to cart',
  instant = false,
}: {
  product: CartDraft
  className: string
  /** Icon-only, for overlaying on a product card. */
  compact?: boolean
  cartKey?: string
  maxQuantity?: number | null
  surface?: CartSurface
  catalogId?: string | null
  label?: string
  /** Adds one unit immediately. Retail cards use this. */
  instant?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState(1)
  const [qtyDraft, setQtyDraft] = useState('1')
  const [added, setAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cap = maxQuantity ?? product.maxQuantity ?? null

  const setQtyValue = (value: number) => {
    const rounded = Math.max(1, Math.round(value) || 1)
    const clamped = cap != null ? Math.min(rounded, cap) : rounded
    setQty(clamped)
    setQtyDraft(String(clamped))
  }

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
    const result = addToCart(
      {
        ...product,
        maxQuantity: cap,
        surface: product.surface || surface,
        catalogId: product.catalogId || catalogId,
      },
      qty,
      cartKey,
    )
    if (result.error) {
      setError(result.error)
      return
    }
    setError(null)
    setOpen(false)
    setQtyValue(1)
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
          setError(null)
          if (instant) {
            const result = addToCart(
              {
                ...product,
                maxQuantity: cap,
                surface: product.surface || surface,
                catalogId: product.catalogId || catalogId,
              },
              1,
              cartKey,
            )
            if (result.error) {
              setError(result.error)
              return
            }
            setAdded(true)
            window.setTimeout(() => setAdded(false), 1600)
            window.dispatchEvent(new Event('giffter-cart-open'))
            return
          }
          setQtyValue(1)
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
            <ShoppingBag size={14} /> {label}
          </span>
        )}
      </button>
      {instant && error ? (
        <span className="mt-1 block text-center text-[11px] text-error" role="alert">
          {error}
        </span>
      ) : null}

      {open
        ? createPortal(
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
                className="relative z-10 w-full max-w-xs rounded-lg border border-cream-border bg-cream-card p-5 shadow-lg"
              >
                <button
                  type="button"
                  aria-label="Close"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setOpen(false)
                  }}
                  className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-cream-surface text-ink-secondary hover:bg-cream"
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
                    <p className="truncate text-sm text-ink">{product.name}</p>
                    {product.price != null ? (
                      <p className="store-price mt-0.5 text-sm">{formatCurrency(product.price)}</p>
                    ) : null}
                  </div>
                </div>

                <p className="store-eyebrow mt-4">Quantity</p>
                <div className="mt-2 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setQtyValue(qty - 1)
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-tertiary text-ink-secondary hover:bg-cream-surface"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="Quantity"
                    value={qtyDraft}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 6)
                      setQtyDraft(digits)
                      if (digits) setQty(Math.max(1, parseInt(digits, 10)))
                    }}
                    onBlur={() => setQtyValue(Number(qtyDraft) || 1)}
                    className="h-11 w-16 shrink-0 rounded border border-ink-tertiary bg-cream-card text-center font-mono text-lg text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setQtyValue(qty + 1)
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-tertiary text-ink-secondary hover:bg-cream-surface"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-cream-muted">
                  {cap != null ? `Up to ${cap} available to buy now.` : 'Type the quantity you need.'}
                </p>
                {error && !instant ? <p className="mt-2 text-center text-[11px] text-error">{error}</p> : null}

                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    confirmAdd()
                  }}
                  className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 bg-saffron px-4 text-sm font-bold text-charcoal hover:bg-saffron-hover"
                >
                  <ShoppingBag size={14} /> Add {qty} to cart
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
