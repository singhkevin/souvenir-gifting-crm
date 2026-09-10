'use client'

import { useState } from 'react'
import { submitPublicQuote } from '@/app/request-quote/actions'
import { BrandName } from '@/components/brand/brand-name'

export function QuoteForm({
  productId,
  productName,
  portalHref,
}: {
  productId?: string
  productName?: string
  portalHref?: string | null
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
    'mt-2 w-full border-b border-[#E8E4DE] bg-transparent py-2 text-sm outline-none focus:border-[#1A3022]'
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
      {productName ? (
        <p className="text-sm text-[#5C6570]">
          Enquiring about <span className="font-medium text-[#1B2430]">{productName}</span>
        </p>
      ) : null}
      {productId ? <input type="hidden" name="product_id" value={productId} /> : null}
      {productName ? <input type="hidden" name="product_name" value={productName} /> : null}
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
      <label className="block">
        <span className={label}>Estimated quantity</span>
        <input name="quantity" className={field} />
      </label>
      <label className="block">
        <span className={label}>Tell us about the occasion</span>
        <textarea required name="message" rows={4} className={field} />
      </label>
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex min-w-[12rem] items-center justify-center bg-[#1A3022] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  )
}
