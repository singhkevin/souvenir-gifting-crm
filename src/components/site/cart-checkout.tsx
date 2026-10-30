'use client'

import { useState } from 'react'
import Link from 'next/link'
import { checkoutStoreCart, checkoutQuotedOrder } from '@/app/catalogue/actions'
import { checkoutPortalCart } from '@/app/portal/catalogue/actions'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import type { CartItem } from '@/lib/catalogue/cart'

export function CartCheckout({
  items,
  kind,
  onDone,
  arranging = false,
  quoteLock,
}: {
  items: CartItem[]
  kind: 'store' | 'portal'
  onDone: () => void
  /** Retail cart has lines that are not in stock. */
  arranging?: boolean
  quoteLock?: {
    token: string
    quotationNumber: string
    fullName: string
    email: string
    phone: string
    companyName: string
    total: number
  }
}) {
  const { pending, error, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [order, setOrder] = useState<{ id?: string; number?: string; arrangement?: boolean; backorderError?: string } | null>(null)
  const [form, setForm] = useState({
    full_name: quoteLock?.fullName || '',
    email: quoteLock?.email || '',
    company_name: quoteLock?.companyName || '',
    phone: quoteLock?.phone || '',
    fax: '',
    needed_by: '',
    note: '',
    notify_stock: false,
  })

  const lines = items.map((item) => ({
    productId: item.id,
    quantity: item.quantity,
    catalogId: item.catalogId || null,
  }))

  const submit = () => {
    run(
      () =>
        kind === 'store'
          ? quoteLock
            ? checkoutQuotedOrder({
                token: quoteLock.token,
                fullName: form.full_name,
                email: form.email,
                phone: form.phone,
                idempotencyKey: key,
              })
            : checkoutStoreCart({
                fullName: form.full_name,
                email: form.email,
                companyName: form.company_name,
                phone: form.phone,
                fax: form.fax,
                lines,
                neededBy: arranging ? form.needed_by : undefined,
                note: arranging ? form.note : undefined,
                notifyStock: arranging ? form.notify_stock : false,
                idempotencyKey: key,
              })
          : checkoutPortalCart({ lines, idempotencyKey: key }),
      {
        successMessage: 'Order placed',
        onSuccess: (result) => {
          rotate()
          const r = result as { orderId?: string; orderNumber?: string; arrangement?: boolean; backorderError?: string } | undefined
          setOrder({ id: r?.orderId, number: r?.orderNumber, arrangement: r?.arrangement, backorderError: r?.backorderError })
          onDone()
        },
      },
    )
  }

  if (order) {
    return (
      <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-4 space-y-2 text-[#1C1C18]">
        <div className="font-sans text-[10px] text-[#9E4300] uppercase font-semibold">Order Confirmed</div>
        <p className="font-serif text-lg font-normal">
          {/* TODO(client): checkout confirmation copy */}
          {order.number
            ? `Order ${order.number}${order.arrangement ? ' · arrangement requested' : ''}.`
            : order.arrangement
              ? 'Arrangement request received.'
              : 'Order placed successfully.'}
        </p>
        <p className="sv2-body-sm text-xs text-[#4A4640]">
          {order.backorderError
            ? order.backorderError
            : order.number
              ? 'Our team will confirm your order and begin fulfilment dispatch.'
              : 'Our team will confirm whether these gifts can be arranged.'}
        </p>
        {kind === 'portal' && order.id ? (
          <Link href={`/portal/orders/${order.id}`} className="inline-flex sv2-label text-[11px] text-[#9E4300] hover:underline pt-1">
            View order in portal &rarr;
          </Link>
        ) : null}
        {quoteLock && order.id ? (
          <Link href={`/business/orders/${order.id}`} className="inline-flex sv2-label text-[11px] text-[#9E4300] hover:underline pt-1">
            View order details &rarr;
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {kind === 'store' ? (
        <fieldset disabled={pending || Boolean(quoteLock)} className="space-y-2">
          <input
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            placeholder="Full Name *"
            autoComplete="name"
            className="w-full border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-2 sv2-body-sm text-[#1C1C18] focus:border-[#000000] outline-none placeholder:text-[#7C766F]"
          />
          <input
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="Email Address *"
            autoComplete="email"
            className="w-full border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-2 sv2-body-sm text-[#1C1C18] focus:border-[#000000] outline-none placeholder:text-[#7C766F]"
          />
          <input
            value={form.company_name}
            onChange={(event) => setForm({ ...form, company_name: event.target.value })}
            placeholder="Company / Organisation (Optional)"
            autoComplete="organization"
            className="w-full border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-2 sv2-body-sm text-[#1C1C18] focus:border-[#000000] outline-none placeholder:text-[#7C766F]"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="Phone Number (for Courier SMS updates)"
            autoComplete="tel"
            className="w-full border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-2 sv2-body-sm text-[#1C1C18] focus:border-[#000000] outline-none placeholder:text-[#7C766F]"
          />
          <input
            value={form.fax}
            onChange={(event) => setForm({ ...form, fax: event.target.value })}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
          {arranging ? (
            <div className="space-y-2 border border-[#CCC5BD] bg-[#FCF9F2] p-3">
              <p className="sv2-label text-[10px] text-[#9E4300]">To arrange · not charged now</p>
              <label className="block sv2-mono-sm text-[11px] text-[#4A4640]">
                Needed by
                <input
                  type="date"
                  value={form.needed_by}
                  onChange={(event) => setForm({ ...form, needed_by: event.target.value })}
                  className="mt-1 w-full border border-[#CCC5BD] bg-[#FCF9F2] px-3 py-2 sv2-body-sm text-[#1C1C18] focus:border-[#000000] outline-none"
                />
              </label>
              <label className="block sv2-mono-sm text-[11px] text-[#4A4640]">
                Note
                <textarea
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                  rows={3}
                  maxLength={2000}
                  placeholder="Anything we should know"
                  className="mt-1 w-full border border-[#CCC5BD] bg-[#FCF9F2] px-3 py-2 sv2-body-sm text-[#1C1C18] focus:border-[#000000] outline-none placeholder:text-[#7C766F]"
                />
              </label>
              <label className="flex items-start gap-2 sv2-body-sm text-xs text-[#1C1C18]">
                <input
                  type="checkbox"
                  checked={form.notify_stock}
                  onChange={(event) => setForm({ ...form, notify_stock: event.target.checked })}
                  className="mt-0.5"
                />
                <span>Email me when this is back in stock</span>
              </label>
            </div>
          ) : null}
        </fieldset>
      ) : null}
      {error ? <p className="sv2-mono-sm text-xs text-[#BA1A1A]">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={submit}
        className="flex w-full items-center justify-center bg-[#9E4300] hover:bg-[#853700] px-4 py-3.5 sv2-label text-white tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Spinner />
            Placing order…
          </span>
        ) : quoteLock ? (
          `Place order · ${quoteLock.quotationNumber}`
        ) : arranging && items.every((item) => (item.stockQty ?? 1) === 0) ? (
          'Send arrangement request'
        ) : arranging ? (
          'Place order · arrange the rest'
        ) : (
          'Place order'
        )}
      </button>
    </div>
  )
}
