'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { checkoutShareCatalog } from '@/app/share/catalogs/actions'
import { formatCurrency } from '@/lib/utils'

export type CatalogBuyOffering = {
  productId: string
  name: string
  price: number | null
  maxBuyQty: number | null
}

type Mode = 'guest' | 'client-share' | 'staff' | 'unassigned'

export function CatalogBuyPanel({
  offerings,
  mode,
  shareToken,
  loginHref,
}: {
  offerings: CatalogBuyOffering[]
  mode: Mode
  shareToken: string
  loginHref?: string
}) {
  const [qty, setQty] = useState<Record<string, string>>({})
  const { pending, error, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [order, setOrder] = useState<{ id?: string; number?: string } | null>(null)

  if (!offerings.length) return null

  if (mode === 'staff') {
    return (
      <section className="rounded-2xl border border-[#E5DFD5] bg-white p-5 text-sm text-[#5A5248]">
        Staff preview. Assigned clients can buy the in-stock gifts after they sign in.
      </section>
    )
  }

  if (mode === 'guest' || mode === 'unassigned') {
    return (
      <section className="rounded-2xl border border-[#E5DFD5] bg-white p-5 text-sm text-[#5A5248]">
        <p>
          {mode === 'guest'
            ? 'Sign in with the company account for this catalog to buy the in-stock gifts.'
            : 'This catalog is not assigned to your company, so these gifts stay on request quote.'}
        </p>
        {mode === 'guest' && loginHref ? (
          <Link href={loginHref} className="mt-3 inline-flex text-sm font-semibold text-[#806A50]">
            Sign in to buy
          </Link>
        ) : null}
      </section>
    )
  }

  if (order) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p>Order {order.number || 'placed'}. The team will confirm the PO.</p>
        {order.id ? (
          <Link href={`/portal/orders/${order.id}`} className="mt-2 inline-flex font-semibold">
            View order
          </Link>
        ) : null}
      </section>
    )
  }

  const submit = () => {
    const lines = offerings.map((offering) => {
      const parsed = Number.parseInt(qty[offering.productId] || '1', 10)
      const whole = Number.isInteger(parsed) && parsed > 0 ? parsed : 1
      const quantity = offering.maxBuyQty != null ? Math.min(whole, offering.maxBuyQty) : whole
      return { productId: offering.productId, quantity, catalogId: null }
    })
    run(() => checkoutShareCatalog({ token: shareToken, lines, idempotencyKey: key }), {
      successMessage: 'Order placed',
      onSuccess: (result) => {
        rotate()
        const r = result as { orderId?: string; orderNumber?: string } | undefined
        setOrder({ id: r?.orderId, number: r?.orderNumber })
      },
    })
  }

  return (
    <section className="rounded-2xl border border-[#E5DFD5] bg-white p-5">
      <h2 className="font-serif text-2xl text-[#1C1917]">Buy now</h2>
      <p className="mt-1 text-sm text-[#5A5248]">These gifts can be ordered at the catalog price. Kits and quote-only gifts stay in the request below.</p>
      <ul className="mt-4 space-y-3">
        {offerings.map((offering) => (
          <li key={offering.productId} className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">{offering.name}</p>
              <p className="text-xs text-[#7A7267]">
                {offering.price == null ? 'Price on request' : formatCurrency(offering.price)}
                {offering.maxBuyQty != null ? ` · up to ${offering.maxBuyQty}` : ''}
              </p>
            </div>
            <input
              inputMode="numeric"
              aria-label={`Quantity for ${offering.name}`}
              value={qty[offering.productId] ?? '1'}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, 6)
                setQty((current) => ({ ...current, [offering.productId]: digits }))
              }}
              disabled={pending}
              className="w-20 rounded-md border border-[#E5DFD5] px-2 py-2 text-center"
            />
          </li>
        ))}
      </ul>
      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        aria-busy={pending || undefined}
        onClick={submit}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#806A50] px-4 text-sm font-semibold text-white hover:bg-[#9C8567] disabled:cursor-not-allowed disabled:opacity-60"
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
    </section>
  )
}
