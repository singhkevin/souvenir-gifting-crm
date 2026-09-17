'use client'

import { useState } from 'react'
import { submitPublicQuote } from '@/app/request-quote/actions'
import { BrandName } from '@/components/brand/brand-name'

export type QuoteFormItem = { id: string; name: string; sku?: string; quantity: number }

export function QuoteForm({
  productId,
  productName,
  items,
  portalHref,
  onSuccess,
}: {
  productId?: string
  productName?: string
  /** Cart mode: multiple products with per-item quantity, in place of a single product. */
  items?: QuoteFormItem[]
  portalHref?: string | null
  onSuccess?: () => void
}) {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)

  if (success) {
    return (
      <div className="px-2 py-8 text-center">
        <p className="font-serif text-2xl text-[#1B2430]">Thank you.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#5C6570]">
          We have received your enquiry. A <BrandName /> account manager will follow up with a quotation.
        </p>
      </div>
    )
  }

  const field =
    'mt-2 w-full border-b border-[#E8E4DE] bg-transparent py-2 text-sm outline-none focus:border-[#806A50]'
  const label = 'text-[10px] font-medium uppercase tracking-[0.16em] text-[#5C6570]'

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        setPending(true)
        const form = new FormData(event.currentTarget)
        const result = await submitPublicQuote(form)
        setPending(false)
        if (result?.error) {
          setError(result.error)
          return
        }
        setSuccess(true)
        onSuccess?.()
      }}
    >
      {portalHref ? (
        <p className="text-sm text-[#5C6570]">
          You already have a client portal.{' '}
          <a href={portalHref} className="underline underline-offset-4">
            Share a requirement there
          </a>{' '}
          if you prefer.
        </p>
      ) : null}
      {items && items.length ? (
        <div className="space-y-1.5 rounded-md border border-[#E8E4DE] bg-[#FAF7F2] p-3">
          <p className={label}>Enquiring about {items.length} product{items.length === 1 ? '' : 's'}</p>
          <ul className="space-y-1 text-sm text-[#1B2430]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 text-[#5C6570]">x {item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : productName ? (
        <p className="text-sm text-[#5C6570]">
          Enquiring about <span className="font-medium text-[#1B2430]">{productName}</span>
        </p>
      ) : null}
      {items && items.length ? (
        <input
          type="hidden"
          name="items_json"
          value={JSON.stringify(items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity })))}
        />
      ) : null}
      {!items?.length && productId ? <input type="hidden" name="product_id" value={productId} /> : null}
      {!items?.length && productName ? <input type="hidden" name="product_name" value={productName} /> : null}
      <input type="text" name="fax" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <label className="block">
        <span className={label}>Name</span>
        <input required name="full_name" className={field} />
      </label>
      <label className="block">
        <span className={label}>Work email</span>
        <input required type="email" name="email" className={field} />
      </label>
      <label className="block">
        <span className={label}>Company</span>
        <input required name="company_name" className={field} />
      </label>
      <label className="block">
        <span className={label}>Phone</span>
        <input name="phone" className={field} />
      </label>
      {items && items.length ? null : (
        <label className="block">
          <span className={label}>Estimated quantity</span>
          <input name="quantity" className={field} />
        </label>
      )}
      <label className="block">
        <span className={label}>Tell us about the occasion</span>
        <textarea required name="message" rows={4} className={field} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex min-w-[12rem] items-center justify-center bg-[#806A50] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#FFFFFF] disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  )
}
