'use client'

import { useId, useState } from 'react'
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
  const fieldId = useId()
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
      <div className="space-y-2 text-sm text-ink">
        <p className="font-semibold">Order {order.number || 'placed'}.</p>
        <p className="text-xs text-ink-secondary">The team will confirm the PO and start fulfilment.</p>
        {kind === 'portal' && order.id ? (
          <Link href={`/portal/orders/${order.id}`} className="inline-flex text-xs font-semibold text-gold-deep">
            View order
          </Link>
        ) : null}
        {quoteLock && order.id ? (
          <Link href={`/business/orders/${order.id}`} className="inline-flex text-xs font-semibold text-gold-deep">
            View order
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {kind === 'store' ? (
        <fieldset disabled={pending || Boolean(quoteLock)} className="space-y-3">
          <div>
            <label htmlFor={`${fieldId}-name`} className="mb-1 block text-[13px] font-semibold text-ink-secondary">Your name</label>
            <input
              id={`${fieldId}-name`}
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              autoComplete="name"
              className="h-11 w-full rounded border border-ink-tertiary bg-cream-card px-3 text-[15px] text-ink"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-email`} className="mb-1 block text-[13px] font-semibold text-ink-secondary">Email</label>
            <input
              id={`${fieldId}-email`}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              className="h-11 w-full rounded border border-ink-tertiary bg-cream-card px-3 text-[15px] text-ink"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-company`} className="mb-1 block text-[13px] font-semibold text-ink-secondary">Company</label>
            <input
              id={`${fieldId}-company`}
              value={form.company_name}
              onChange={(event) => setForm({ ...form, company_name: event.target.value })}
              autoComplete="organization"
              className="h-11 w-full rounded border border-ink-tertiary bg-cream-card px-3 text-[15px] text-ink"
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-phone`} className="mb-1 block text-[13px] font-semibold text-ink-secondary">Phone (optional)</label>
            <input
              id={`${fieldId}-phone`}
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              autoComplete="tel"
              className="h-11 w-full rounded border border-ink-tertiary bg-cream-card px-3 text-[15px] text-ink"
            />
          </div>
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
      {error ? (
        <p id={`${fieldId}-error`} className="text-xs text-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        onClick={submit}
        className="flex min-h-11 w-full items-center justify-center bg-saffron px-4 text-sm font-bold text-charcoal hover:bg-saffron-hover disabled:cursor-not-allowed disabled:opacity-50"
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
