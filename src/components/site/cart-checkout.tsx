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
  quoteLock,
}: {
  items: CartItem[]
  kind: 'store' | 'portal'
  onDone: () => void
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
  const [order, setOrder] = useState<{ id?: string; number?: string } | null>(null)
  const [form, setForm] = useState({
    full_name: quoteLock?.fullName || '',
    email: quoteLock?.email || '',
    company_name: quoteLock?.companyName || '',
    phone: quoteLock?.phone || '',
    fax: '',
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
            : checkoutStoreCart({ ...form, lines, idempotencyKey: key })
          : checkoutPortalCart({ lines, idempotencyKey: key }),
      {
        successMessage: 'Order placed',
        onSuccess: (result) => {
          rotate()
          const r = result as { orderId?: string; orderNumber?: string } | undefined
          setOrder({ id: r?.orderId, number: r?.orderNumber })
          onDone()
        },
      },
    )
  }

  if (order) {
    return (
      <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-4 space-y-2 text-[#1C1C18]">
        <div className="font-sans text-[10px] text-[#9E4300] uppercase font-semibold">Order Confirmed</div>
        <p className="font-serif text-lg font-normal">Order {order.number || 'placed successfully'}.</p>
        <p className="sv2-body-sm text-xs text-[#4A4640]">Our team will confirm your order and begin fulfilment dispatch.</p>
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
        ) : (
          'Place order'
        )}
      </button>
    </div>
  )
}
