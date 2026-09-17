'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, X, Minus, Plus, Trash2 } from 'lucide-react'
import {
  readCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
  type CartItem,
} from '@/lib/catalogue/cart'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'
import { QuoteModal } from '@/components/site/quote-modal'

export function CartDrawer({ iconClassName = 'text-[#241C12]' }: { iconClassName?: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    const sync = () => setItems(readCart())
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('giffter-cart-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('giffter-cart-change', sync)
    }
  }, [])

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
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-[0_0_60px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#E8E4DE] px-5 py-4">
              <h2 className="font-serif text-xl text-[#1B2430]">Your cart</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F6F4F1] text-[#5C6570] hover:bg-[#EFE9E0]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ShoppingBag size={28} className="text-[#C4B8A8]" />
                  <p className="mt-3 text-sm text-[#5C6570]">Your cart is empty.</p>
                  <p className="mt-1 text-xs text-[#8A929C]">
                    Add products from the catalogue to request a quote for several items at once.
                  </p>
                </div>
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
                            onClick={() => setItems(updateCartQuantity(item.id, item.quantity - 1))}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5DFD5] text-[#5C6570] hover:bg-[#FAF7F2]"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setItems(updateCartQuantity(item.id, item.quantity + 1))}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E5DFD5] text-[#5C6570] hover:bg-[#FAF7F2]"
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove from cart"
                            onClick={() => setItems(removeFromCart(item.id))}
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

            {items.length > 0 ? (
              <div className="space-y-3 border-t border-[#E8E4DE] px-5 py-4">
                {subtotal > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#5C6570]">Estimated subtotal</span>
                    <span className="font-semibold text-[#1B2430]">{formatCurrency(subtotal)}</span>
                  </div>
                ) : null}
                <QuoteModal
                  items={items.map((item) => ({ id: item.id, name: item.name, sku: item.sku, quantity: item.quantity }))}
                  triggerClassName="flex w-full items-center justify-center bg-[#806A50] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#9C8567]"
                  onClose={(submitted) => {
                    if (submitted) {
                      clearCart()
                      setItems([])
                      setOpen(false)
                    }
                  }}
                >
                  Request a quote for {count} item{count === 1 ? '' : 's'}
                </QuoteModal>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
