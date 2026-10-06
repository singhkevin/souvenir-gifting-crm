'use client'

import { useEffect, useState } from 'react'
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
  iconClassName = 'text-[#241C12]',
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

  useEffect(() => {
    const sync = () => setItems(readCart(cartKey))
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('giffter-cart-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('giffter-cart-change', sync)
    }
  }, [cartKey])

  const closeDrawer = () => {
    setOpen(false)
    setPlaced(false)
  }

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
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
          <span className="absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-white bg-[#C0392B] px-1 text-[10px] font-bold leading-none text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button
            type="button"
            aria-label="Close cart"
            className="absolute inset-0 bg-black/45"
            onClick={closeDrawer}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-[0_0_60px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#E8E4DE] px-5 py-4">
              <h2 className="font-serif text-xl text-[#1B2430]">Your cart</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeDrawer}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F6F4F1] text-[#5C6570] hover:bg-[#EFE9E0]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                placed ? null : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ShoppingBag size={28} className="text-[#C4B8A8]" />
                  <p className="mt-3 text-sm text-[#5C6570]">Your cart is empty.</p>
                  <p className="mt-1 text-xs text-[#8A929C]">
                    {kind === 'store'
                      ? 'Add gifts that are ready to buy. Quote-only gifts use Request a quote.'
                      : 'Add gifts that are ready to buy. Quote-only gifts use Request quote.'}
                  </p>
                </div>
                )
              ) : (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md catalogue-studio-field">
                        <ProductImage
                          src={item.image_url}
                          alt={item.name}
                          size="sm"
                          fit="contain"
                          className="h-full w-full bg-transparent"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[#1B2430]">{item.name}</p>
                        {item.price != null ? (
                          <p className="mt-0.5 text-xs text-[#806A50]">{formatCurrency(item.price)}</p>
                        ) : null}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => setItems(updateCartQuantity(item.id, item.quantity - 1, cartKey))}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5DFD5] text-[#5C6570] hover:bg-[#FAF7F2]"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setItems(updateCartQuantity(item.id, item.quantity + 1, cartKey))}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5DFD5] text-[#5C6570] hover:bg-[#FAF7F2]"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove from cart"
                            onClick={() => setItems(removeFromCart(item.id, cartKey))}
                            className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-[#8A929C] hover:bg-red-50 hover:text-red-700"
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
              <div className="space-y-3 border-t border-[#E8E4DE] px-5 py-4">
                {items.length > 0 && subtotal > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#5C6570]">Estimated subtotal</span>
                    <span className="font-semibold text-[#1B2430]">{formatCurrency(subtotal)}</span>
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
