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
import { siteContent } from '@/config/siteContent'
import { HEADER_ICON_CLASS, HeaderCountBadge } from '@/components/sv2/header-actions'

export function CartDrawer({
  iconClassName = 'text-[#1C1C18]',
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
        aria-label={`Bag, ${count} item${count === 1 ? '' : 's'}`}
        title="Bag"
        className={`${HEADER_ICON_CLASS} ${iconClassName}`}
      >
        <ShoppingBag size={17} strokeWidth={1.8} aria-hidden="true" />
        <HeaderCountBadge count={count} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button
            type="button"
            aria-label="Close cart"
            className="absolute inset-0 bg-[#1C1B1A]/60"
            onClick={closeDrawer}
          />
          <aside
            aria-label="Retail Shopping Bag Drawer"
            className="relative z-10 flex h-full w-full max-w-[480px] flex-col justify-between border-l border-[#CCC5BD] bg-[#FCF9F2] text-[#1C1C18]"
          >
            {/* Drawer Top Header */}
            <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-sans text-xs text-[#9E4300] uppercase tracking-wider font-semibold">
                  Shopping Bag
                </span>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={closeDrawer}
                  className="flex h-7 w-7 items-center justify-center border border-[#CCC5BD] bg-[#FCF9F2] text-[#1C1C18] hover:bg-white transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="flex items-baseline justify-between">
                <h2 className="font-serif text-2xl font-normal text-[#1C1C18]">Your Bag ({count})</h2>
                <span className="border border-[#3A4537]/30 bg-[#DAE6D3] text-[#3A4537] px-2 py-0.5 sv2-label text-[10px] font-semibold">
                  Ready to Ship
                </span>
              </div>
              {/* Shipping progress note */}
              <div className="mt-3 pt-2.5 border-t border-[#CCC5BD]/60">
                <p className="font-sans text-[11px] text-[#7C766F] tracking-wide">
                  {siteContent.retail.packagingNote}
                </p>
              </div>
            </div>

            {/* Scrollable Cart Items Rail */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-[#FCF9F2]">
              {items.length === 0 ? (
                placed ? null : (
                  <div className="flex h-full flex-col items-center justify-center text-center py-12">
                    <ShoppingBag size={32} className="text-[#CCC5BD]" />
                    <p className="mt-3 font-serif text-xl text-[#1C1C18]">Your bag is empty.</p>
                    <p className="mt-1 sv2-body-sm text-xs text-[#7C766F] max-w-xs">
                      {kind === 'store'
                        ? 'Add gifts or sample items from our live retail catalogue.'
                        : 'Add gifts that are ready to buy. Quote-only gifts use Request quote.'}
                    </p>
                  </div>
                )
              ) : (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li key={item.id} className="p-3.5 bg-[#F6F3EC] border border-[#CCC5BD] flex flex-col gap-2.5">
                      <div className="flex gap-3.5">
                        <div className="h-20 w-20 shrink-0 overflow-hidden border border-[#CCC5BD] bg-[#F1EEE7]">
                          <ProductImage
                            src={item.image_url}
                            alt={item.name}
                            size="sm"
                            fit="contain"
                            className="h-full w-full bg-transparent"
                          />
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-serif text-[16px] leading-snug font-normal text-[#1C1C18] line-clamp-2">
                                {item.name}
                              </h4>
                              <button
                                type="button"
                                aria-label="Remove item"
                                onClick={() => setItems(removeFromCart(item.id, cartKey))}
                                className="text-[#7C766F] hover:text-[#BA1A1A] p-0.5 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-[#CCC5BD]/50 mt-1">
                            {/* Stepper */}
                            <div className="inline-flex items-center border border-[#CCC5BD] bg-[#FCF9F2]">
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                onClick={() => setItems(updateCartQuantity(item.id, item.quantity - 1, cartKey))}
                                className="w-6 h-6 flex items-center justify-center sv2-mono-sm text-[#1C1C18] hover:bg-[#F1EEE7] transition-colors"
                              >
                                <Minus size={11} />
                              </button>
                              <span className="w-7 h-6 flex items-center justify-center sv2-mono-sm text-xs font-semibold border-x border-[#CCC5BD] text-[#1C1C18]">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                aria-label="Increase quantity"
                                onClick={() => setItems(updateCartQuantity(item.id, item.quantity + 1, cartKey))}
                                className="w-6 h-6 flex items-center justify-center sv2-mono-sm text-[#1C1C18] hover:bg-[#F1EEE7] transition-colors"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                            {/* Price */}
                            <div className="text-right">
                              <span className="sv2-mono-md font-bold text-[#1C1C18]">
                                {item.price != null ? formatCurrency(item.price * item.quantity) : 'On quote'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Bottom Fixed Footer */}
            {items.length > 0 || placed ? (
              <div className="border-t border-[#CCC5BD] bg-[#F6F3EC] px-6 py-4 flex-shrink-0 space-y-3.5">
                {items.length > 0 && subtotal > 0 ? (
                  <div className="space-y-1.5 sv2-mono-sm text-xs border-b border-[#CCC5BD] pb-3">
                    <div className="flex justify-between text-[#4A4640]">
                      <span>Subtotal ({count} item{count === 1 ? '' : 's'})</span>
                      <span className="font-semibold text-[#1C1C18]">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1 text-[#1C1C18]">
                      <span className="sv2-label font-bold text-[11px]">Estimated total</span>
                      <span className="sv2-mono-lg font-bold text-[#1C1C18]">{formatCurrency(subtotal)}</span>
                    </div>
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
          </aside>
        </div>
      ) : null}
    </>
  )
}
