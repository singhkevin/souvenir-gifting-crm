'use client'

import { useEffect, useRef, useState } from 'react'
import { ShoppingBag, X, Minus, Plus, Trash2 } from 'lucide-react'
import {
  readCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
  STORE_CART_KEY,
  type CartItem,
} from '@/lib/catalogue/cart'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'
import { CartCheckout } from '@/components/site/cart-checkout'

export function CartDrawer({
  iconClassName = 'text-charcoal',
  cartKey = STORE_CART_KEY,
  kind = 'store',
}: {
  iconClassName?: string
  cartKey?: string
  kind?: 'store' | 'portal'
}) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CartItem[]>([])
  const [placed, setPlaced] = useState(false)
  const [shown, setShown] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sync = () => setItems(readCart(cartKey))
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('giffter-cart-change', sync)
    const openDrawer = () => setOpen(true)
    window.addEventListener('giffter-cart-open', openDrawer)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('giffter-cart-change', sync)
      window.removeEventListener('giffter-cart-open', openDrawer)
    }
  }, [cartKey])

  const closeDrawer = () => {
    setOpen(false)
    setPlaced(false)
    setShown(false)
  }

  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const root = panelRef.current
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusables = () =>
      root ? [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => !el.hasAttribute('disabled')) : []
    const previouslyFocused = document.activeElement as HTMLElement | null
    focusables()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setPlaced(false)
        setShown(false)
        return
      }
      if (event.key !== 'Tab' || !root) return
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      previouslyFocused?.focus()
    }
  }, [open])

  const count = getCartCount(items)
  const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
        className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.06] lg:h-10 lg:w-10 ${iconClassName}`}
      >
        <ShoppingBag size={21} strokeWidth={1.75} />
        {count > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-saffron px-1 text-[10px] leading-none font-bold text-charcoal">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close cart"
            className="absolute inset-0 bg-charcoal/45"
            onClick={closeDrawer}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Your cart"
            className={`relative z-10 flex h-full w-full max-w-md flex-col rounded-l-lg border-l border-cream-border bg-cream-card shadow-drawer transition-transform duration-300 ease-out ${shown ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-cream-border px-5 py-4">
              <h2 className="store-ui-title text-ink">Your cart</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeDrawer}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-surface text-ink-secondary hover:bg-cream"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                placed ? null : (
                <div className="flex h-full flex-col items-center justify-center border border-dashed border-cream-border bg-cream-surface px-6 py-10 text-center">
                  <ShoppingBag size={28} className="text-ink-tertiary" />
                  <p className="mt-3 font-serif text-xl text-ink">Your cart is empty.</p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    {kind === 'store'
                      ? 'Add an in-stock gift from the catalogue.'
                      : 'Add gifts that are ready to buy.'}
                  </p>
                </div>
                )
              ) : (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-cream-border bg-cream-surface">
                        <ProductImage
                          src={item.image_url}
                          alt={item.name}
                          size="sm"
                          fit="contain"
                          className="h-full w-full bg-transparent"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{item.name}</p>
                        {item.price != null && item.price > 0 ? (
                          <p className="store-price mt-0.5 text-sm">{formatCurrency(item.price)}</p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => setItems(updateCartQuantity(item.id, item.quantity - 1, cartKey))}
                            className="flex h-11 w-11 items-center justify-center rounded border border-ink-tertiary text-ink-secondary hover:bg-cream-surface"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center font-mono text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setItems(updateCartQuantity(item.id, item.quantity + 1, cartKey))}
                            className="flex h-11 w-11 items-center justify-center rounded border border-ink-tertiary text-ink-secondary hover:bg-cream-surface"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove from cart"
                            onClick={() => setItems(removeFromCart(item.id, cartKey))}
                            className="ml-auto flex h-11 w-11 items-center justify-center rounded text-ink-tertiary hover:bg-error-bg hover:text-error"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 || placed ? (
              <div className="space-y-3 border-t border-cream-border px-5 py-4">
                {items.length > 0 && subtotal > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-secondary">Estimated subtotal</span>
                    <span className="store-price text-base">{formatCurrency(subtotal)}</span>
                  </div>
                ) : null}
                <CartCheckout
                  items={items}
                  kind={kind}
                  onDone={() => {
                    clearCart(cartKey)
                    setItems([])
                    setPlaced(true)
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
