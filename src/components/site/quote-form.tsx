'use client'

import { useState } from 'react'
import { submitPublicQuote } from '@/app/request-quote/actions'

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
      <div className="border border-[#E5DFD5] bg-white px-6 py-10 text-center">
        <p className="font-serif text-2xl text-[#1C1917]">Thank you.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#6B6358]">
          We have received your enquiry. A GIFFTER account manager will follow up with a quotation.
        </p>
      </div>
    )
  }

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
      {portalHref && (
        <p className="text-sm text-[#6B6358]">
          You already have a client portal.{' '}
          <a href={portalHref} className="underline underline-offset-4">
            Share a requirement there
          </a>{' '}
          if you prefer.
        </p>
      )}
      {productName && (
        <p className="text-sm text-[#5A5248]">
          Enquiring about <span className="font-medium text-[#1C1917]">{productName}</span>
        </p>
      )}
      {productId ? <input type="hidden" name="product_id" value={productId} /> : null}
      {productName ? <input type="hidden" name="product_name" value={productName} /> : null}
      <input type="text" name="fax" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#7A7267]">Name</span>
        <input
          required
          name="full_name"
          className="mt-2 w-full border-b border-[#D6CEBE] bg-transparent py-2 text-sm outline-none focus:border-[#1A3022]"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#7A7267]">Work email</span>
        <input
          required
          type="email"
          name="email"
          className="mt-2 w-full border-b border-[#D6CEBE] bg-transparent py-2 text-sm outline-none focus:border-[#1A3022]"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#7A7267]">Company</span>
        <input
          required
          name="company_name"
          className="mt-2 w-full border-b border-[#D6CEBE] bg-transparent py-2 text-sm outline-none focus:border-[#1A3022]"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#7A7267]">Phone</span>
        <input
          name="phone"
          className="mt-2 w-full border-b border-[#D6CEBE] bg-transparent py-2 text-sm outline-none focus:border-[#1A3022]"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#7A7267]">Estimated quantity</span>
        <input
          name="quantity"
          className="mt-2 w-full border-b border-[#D6CEBE] bg-transparent py-2 text-sm outline-none focus:border-[#1A3022]"
        />
      </label>
      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#7A7267]">Tell us about the occasion</span>
        <textarea
          required
          name="message"
          rows={4}
          className="mt-2 w-full border-b border-[#D6CEBE] bg-transparent py-2 text-sm outline-none focus:border-[#1A3022]"
        />
      </label>
      {error && <p className="text-sm text-red-800">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex min-w-[12rem] items-center justify-center bg-[#1A3022] px-6 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#FAF7F2] disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  )
}
