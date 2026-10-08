'use client'

import { useState } from 'react'
import Link from 'next/link'
import { checkoutStoreCart } from '@/app/catalogue/actions'
import { checkoutPortalCart } from '@/app/portal/catalogue/actions'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import type { CartItem } from '@/lib/catalogue/cart'

export function CartCheckout({
  items,
  kind,
  onDone,
}: {
  items: CartItem[]
  kind: 'store' | 'portal'
  onDone: () => void
}) {
  const { pending, error, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [order, setOrder] = useState<{ id?: string; number?: string } | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', company_name: '', phone: '', fax: '' })

  const lines = items.map((item) => ({
    productId: item.id,
    quantity: item.quantity,
    catalogId: item.catalogId || null,
  }))

  const submit = () => {
    run(
      () =>
        kind === 'store'
          ? checkoutStoreCart({ ...form, lines, idempotencyKey: key })
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
      <div className="space-y-2 text-sm text-[#1B2430]">
        <p className="font-semibold">Order {order.number || 'placed'}.</p>
        <p className="text-xs text-[#5C6570]">The team will confirm the PO and start fulfilment.</p>
        {kind === 'portal' && order.id ? (
          <Link href={`/portal/orders/${order.id}`} className="inline-flex text-xs font-semibold text-[#806A50]">
            View order
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {kind === 'store' ? (
        <fieldset disabled={pending} className="space-y-2">
          <input
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
            placeholder="Your name"
            autoComplete="name"
            className="w-full rounded-md border border-[#E5DFD5] px-3 py-2 text-sm"
          />
          <input
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-md border border-[#E5DFD5] px-3 py-2 text-sm"
          />
          <input
            value={form.company_name}
            onChange={(event) => setForm({ ...form, company_name: event.target.value })}
            placeholder="Company"
            autoComplete="organization"
            className="w-full rounded-md border border-[#E5DFD5] px-3 py-2 text-sm"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            placeholder="Phone (optional)"
            autoComplete="tel"
            className="w-full rounded-md border border-[#E5DFD5] px-3 py-2 text-sm"
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
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={submit}
        className="flex w-full items-center justify-center bg-[#806A50] px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#9C8567] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Spinner />
            Placing order…
          </span>
        ) : (
          'Place order'
        )}
      </button>
    </div>
  )
}
