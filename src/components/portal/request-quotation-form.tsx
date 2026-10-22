'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortalRequirement } from '@/app/portal/actions'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { readCatalogueShortlist } from '@/lib/portal/catalogue-shortlist'
import { ProductThumb } from '@/components/ui/product-thumb'

const PURPOSE_OPTIONS = [
  { value: 'festival', label: 'Festival (Diwali, Christmas, etc)' },
  { value: 'welcome_kit', label: 'Employee Welcome Kit' },
  { value: 'anniversary', label: 'Work Anniversary' },
  { value: 'client_gifting', label: 'Client Gifting' },
  { value: 'event', label: 'Event / Conference' },
  { value: 'other', label: 'Other' },
]

export function RequestQuotationForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const { pending, error: actionError, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [validationError, setValidationError] = useState<string | null>(null)
  const error = validationError ?? actionError
  
  // Get shortlisted items
  const [shortlistedProducts, setShortlistedProducts] = useState<ReturnType<typeof readCatalogueShortlist>>([])
  useEffect(() => {
    const sync = () => setShortlistedProducts(readCatalogueShortlist())
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('giffter-shortlist-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('giffter-shortlist-change', sync)
    }
  }, [])

  const [formData, setFormData] = useState({
    name: '',
    purpose: '',
    description: '',
    budget_per_unit: '',
    quantity: '',
    deadline: '',
    delivery_city: '',
  })
  const [lineQty, setLineQty] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1 && !formData.purpose) {
      setValidationError('Please select a purpose / occasion.')
      return
    }
    if (step === 2 && !formData.deadline) {
      setValidationError('Please choose a required-by date.')
      return
    }
    if (step < 3) {
      setValidationError(null)
      setStep(step + 1)
      return
    }

    setValidationError(null)
    run(
      () =>
        createPortalRequirement({
          ...formData,
          products: shortlistedProducts.map((product) => product.sku),
          lines: shortlistedProducts.map((product) => ({
            sku: product.sku,
            quantity: Number.parseInt(lineQty[product.sku] || formData.quantity || '1', 10) || 1,
          })),
          idempotencyKey: key,
        }),
      {
        successMessage: 'Quotation request sent',
        onSuccess: () => {
          rotate()
          router.push('/portal/quotes')
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-3xl min-w-0 space-y-8">
      {/* Page Title */}
      <div className="border-b border-[#CCC5BD] pb-6">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
          Client portal · Request a quote
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1C18] tracking-tight">Request Quotation</h1>
        <p className="mt-2 text-sm text-[#4A4640]">
          Tell us what you need, and we&apos;ll prepare a quote.
        </p>
      </div>

      {/* 3-Step Indicator */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className={`p-3 border text-left rounded-none transition-colors ${
            step === 1
              ? 'border-[#1C1B1A] bg-[#1C1B1A] text-white'
              : step > 1
              ? 'border-[#CCC5BD] bg-[#F6F3EC] text-[#1C1C18]'
              : 'border-[#CCC5BD] bg-[#F1EEE7] text-[#7C766F]'
          }`}
        >
          <span className="block font-mono text-xs font-bold">01</span>
          <span className="block text-[10px] font-bold uppercase tracking-wider mt-0.5 truncate">
            Requirement
          </span>
        </div>
        <div
          className={`p-3 border text-left rounded-none transition-colors ${
            step === 2
              ? 'border-[#1C1B1A] bg-[#1C1B1A] text-white'
              : step > 2
              ? 'border-[#CCC5BD] bg-[#F6F3EC] text-[#1C1C18]'
              : 'border-[#CCC5BD] bg-[#F1EEE7] text-[#7C766F]'
          }`}
        >
          <span className="block font-mono text-xs font-bold">02</span>
          <span className="block text-[10px] font-bold uppercase tracking-wider mt-0.5 truncate">
            Budget
          </span>
        </div>
        <div
          className={`p-3 border text-left rounded-none transition-colors ${
            step === 3
              ? 'border-[#1C1B1A] bg-[#1C1B1A] text-white'
              : 'border-[#CCC5BD] bg-[#F1EEE7] text-[#7C766F]'
          }`}
        >
          <span className="block font-mono text-xs font-bold">03</span>
          <span className="block text-[10px] font-bold uppercase tracking-wider mt-0.5 truncate">
            Gift Selection
          </span>
        </div>
      </div>

      {/* Form Card */}
      <div className="border border-[#CCC5BD] bg-white rounded-none p-6 sm:p-8 space-y-6">
        {error && (
          <div className="border border-[#BA1A1A] bg-[#FFDAD6] p-4 text-xs text-[#BA1A1A] font-medium rounded-none">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" aria-busy={pending || undefined}>
          <fieldset disabled={pending} className="contents">
            {step === 1 && (
              <div className="space-y-6">
                <div className="border-b border-[#CCC5BD] pb-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">
                    Step 01 · General information
                  </span>
                  <h2 className="font-serif text-2xl text-[#1C1C18] mt-1">What do you need?</h2>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">
                    Request name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-[#F1EEE7] border border-[#CCC5BD] px-3.5 py-3 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none placeholder:text-[#7C766F]"
                    placeholder="e.g. Diwali Gifts 2026"
                  />
                </div>

                <div>
                  <MobileSheetSelect
                    label="Purpose / Occasion *"
                    showDesktopLabel
                    emptyLabel="Select an occasion"
                    value={formData.purpose}
                    onChange={(purpose) => setFormData({ ...formData, purpose })}
                    options={PURPOSE_OPTIONS}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">
                    Description (optional)
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full bg-[#F1EEE7] border border-[#CCC5BD] px-3.5 py-3 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none placeholder:text-[#7C766F]"
                    placeholder="Any specific themes, colors, or preferences?"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="border-b border-[#CCC5BD] pb-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">
                    Step 02 · Budget and delivery
                  </span>
                  <h2 className="font-serif text-2xl text-[#1C1C18] mt-1">Budget & Logistics</h2>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">
                      Target Budget Per Unit (INR) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 font-mono text-sm text-[#7C766F]">₹</span>
                      <input
                        type="number"
                        name="budget_per_unit"
                        required
                        value={formData.budget_per_unit}
                        onChange={handleChange}
                        min="1"
                        step="0.01"
                        className="w-full bg-[#F1EEE7] border border-[#CCC5BD] pl-8 pr-3.5 py-3 text-sm font-mono text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none placeholder:text-[#7C766F]"
                        placeholder="e.g. 50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">
                      Total quantity *
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      required
                      value={formData.quantity}
                      onChange={handleChange}
                      min="1"
                      className="w-full bg-[#F1EEE7] border border-[#CCC5BD] px-3.5 py-3 text-sm font-mono text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none placeholder:text-[#7C766F]"
                      placeholder="e.g. 100"
                    />
                  </div>
                </div>

                <div>
                  <SheetDateField
                    label="Required Delivery Date *"
                    value={formData.deadline}
                    onChange={(deadline) => setFormData({ ...formData, deadline })}
                    showDesktopLabel
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">
                    Delivery city *
                  </label>
                  <input
                    type="text"
                    name="delivery_city"
                    required
                    value={formData.delivery_city}
                    onChange={handleChange}
                    className="w-full bg-[#F1EEE7] border border-[#CCC5BD] px-3.5 py-3 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none placeholder:text-[#7C766F]"
                    placeholder="e.g. New York"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="border-b border-[#CCC5BD] pb-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">
                    Step 03 · Gift selection
                  </span>
                  <h2 className="font-serif text-2xl text-[#1C1C18] mt-1">Products & Quantities</h2>
                  <p className="mt-1 text-xs text-[#4A4640]">
                    Enter a quantity for each gift in your quote basket.
                  </p>
                </div>
                
                {shortlistedProducts.length === 0 ? (
                  <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-6 text-center text-xs text-[#7C766F] rounded-none">
                    Your quote basket is empty. You can still send the request.
                  </div>
                ) : (
                  <div className="border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
                    {shortlistedProducts.map((p) => (
                      <div
                        key={p.sku || p.id}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-[#F6F3EC] transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <ProductThumb src={p.image_url} alt={p.name} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#1C1C18]">{p.name}</p>
                            <p className="font-mono text-[10px] text-[#7C766F] mt-0.5">SKU: {p.sku}</p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-[#7C766F]">
                          <span className="font-bold uppercase tracking-wider text-[10px]">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={lineQty[p.sku] ?? (formData.quantity || '1')}
                            onChange={(event) => setLineQty((current) => ({ ...current, [p.sku]: event.target.value }))}
                            className="w-24 bg-[#F1EEE7] border border-[#CCC5BD] px-2.5 py-1.5 font-mono text-xs text-center text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none"
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#CCC5BD]">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="w-full sm:w-auto inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] border border-[#CCC5BD] text-[#1C1C18] bg-white hover:bg-[#F6F3EC] rounded-none transition-colors"
                >
                  Back
                </button>
              ) : (
                <div className="hidden sm:block"></div>
              )}
              
              <button
                type="submit"
                disabled={pending}
                className="w-full sm:w-auto inline-flex min-h-11 items-center justify-center px-8 py-3 text-xs font-bold uppercase tracking-[0.12em] bg-[#9E4300] hover:bg-[#FF8843] text-white rounded-none transition-colors disabled:opacity-50"
              >
                {step < 3 ? (
                  'Next step →'
                ) : pending ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Spinner />
                    Submitting…
                  </span>
                ) : (
                  'Request quotation'
                )}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  )
}
