'use client'

import { useState } from 'react'
import { submitPublicQuote } from '@/app/request-quote/actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
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
  const [success, setSuccess] = useState(false)

  if (success) {
    return (
      <div className="px-2 py-8 text-center space-y-3">
        <p className="font-serif text-2xl text-[#1C1C18]">Thank you.</p>
        <p className="mx-auto max-w-md sv2-body-sm text-[#4A4640]">
          We have received your enquiry. A <BrandName /> representative will follow up with your quotation.
        </p>
      </div>
    )
  }

  const field =
    'mt-1.5 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3.5 py-2.5 sv2-body-sm text-[#1C1C18] outline-none focus:border-[#000000] transition-colors'
  const label = 'block sv2-label text-[10px] text-[#4A4640]'

  return (
    <ActionForm
      action={submitPublicQuote}
      className="space-y-4"
      successMessage="Enquiry sent"
      refresh={false}
      onSuccess={() => {
        setSuccess(true)
        onSuccess?.()
      }}
    >
      {portalHref ? (
        <p className="sv2-body-sm text-xs text-[#7C766F]">
          You have an active client portal.{' '}
          <a href={portalHref} className="text-[#9E4300] underline underline-offset-4">
            Share requirements on your portal
          </a>{' '}
          if you prefer.
        </p>
      ) : null}
      {items && items.length ? (
        <div className="space-y-2 border border-[#CCC5BD] bg-[#F6F3EC] p-3">
          <p className={label}>Enquiring about {items.length} product{items.length === 1 ? '' : 's'}</p>
          <ul className="space-y-1 sv2-body-sm text-xs text-[#1C1C18]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 border-b border-[#CCC5BD]/40 pb-1 last:border-0 last:pb-0">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 sv2-mono-sm font-semibold text-[#7C766F]">&times; {item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : productName ? (
        <div className="p-3 border border-[#CCC5BD] bg-[#F6F3EC]">
          <p className="sv2-body-sm text-xs text-[#7C766F]">
            Enquiring about: <strong className="text-[#1C1C18] font-medium">{productName}</strong>
          </p>
        </div>
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
        <span className={label}>Full Name *</span>
        <input required name="full_name" placeholder="e.g. Siddharth Rao" className={field} />
      </label>
      <label className="block">
        <span className={label}>Work Email *</span>
        <input required type="email" name="email" placeholder="e.g. siddharth@company.com" className={field} />
      </label>
      <label className="block">
        <span className={label}>Company / Organisation *</span>
        <input required name="company_name" placeholder="e.g. Acme Enterprises" className={field} />
      </label>
      <label className="block">
        <span className={label}>Mobile Number (Optional)</span>
        <input name="phone" placeholder="e.g. +91 98000 00000" className={field} />
      </label>
      {items && items.length ? null : (
        <label className="block">
          <span className={label}>Estimated Quantity (Units)</span>
          <input name="quantity" placeholder="e.g. 50" className={field} />
        </label>
      )}
      <label className="block">
        <span className={label}>Tell us about the occasion / delivery timeline *</span>
        <textarea required name="message" rows={3} placeholder="Occasion, cities, required delivery date, or branding requirements..." className={field} />
      </label>
      <div className="pt-2">
        <SubmitButton
          pendingLabel="Sending enquiry…"
          className="w-full sm:w-auto inline-flex items-center justify-center bg-[#000000] hover:bg-[#9E4300] px-8 py-3.5 sv2-label text-white tracking-wider transition-colors"
        >
          Send Enquiry
        </SubmitButton>
      </div>
    </ActionForm>
  )
}
