'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { QuoteForm, type QuoteFormItem } from '@/components/site/quote-form'

export function QuoteModal({
  productId,
  productName,
  items,
  portalHref,
  triggerClassName,
  children,
  onClose,
}: {
  productId?: string
  productName?: string
  items?: QuoteFormItem[]
  portalHref?: string | null
  triggerClassName: string
  children: ReactNode
  /** Called when the modal closes (e.g. to clear a cart after a successful submission). */
  onClose?: (submitted: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const close = () => {
    setOpen(false)
    onClose?.(submitted)
    setSubmitted(false)
  }

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {children}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/45"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-md bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:p-8"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="store-eyebrow">Request a quote</p>
                <h2 className="mt-1 font-serif text-2xl text-[#1B2430]">Tell us about the programme.</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F6F4F1] text-[#5C6570] hover:bg-[#EFE9E0]"
              >
                <X size={16} />
              </button>
            </div>
            <QuoteForm
              productId={productId}
              productName={productName}
              items={items}
              portalHref={portalHref}
              onSuccess={() => setSubmitted(true)}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
