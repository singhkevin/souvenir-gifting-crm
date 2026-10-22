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
            className="absolute inset-0 bg-[#1C1B1A]/60"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto border border-[#CCC5BD] bg-[#FCF9F2] p-6 sm:p-8 text-[#1C1C18]"
          >
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#CCC5BD] pb-4">
              <div>
                <p className="font-sans text-xs uppercase tracking-wider font-semibold text-[#9E4300]">Request a Quote</p>
                <h2 className="mt-1 font-serif text-2xl font-normal text-[#1C1C18]">Tell us about the programme.</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#CCC5BD] bg-[#F6F3EC] text-[#1C1C18] hover:bg-[#FCF9F2]"
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
