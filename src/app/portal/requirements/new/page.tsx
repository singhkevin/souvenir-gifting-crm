'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortalRequirement } from '@/app/portal/actions'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { readCatalogueShortlist } from '@/lib/portal/catalogue-shortlist'

const PURPOSE_OPTIONS = [
  { value: 'festival', label: 'Festival (Diwali, Christmas, etc)' },
  { value: 'welcome_kit', label: 'Employee Welcome Kit' },
  { value: 'anniversary', label: 'Work Anniversary' },
  { value: 'client_gifting', label: 'Client Gifting' },
  { value: 'event', label: 'Event / Conference' },
  { value: 'other', label: 'Other' },
]

export default function NewRequirementPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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
    products: [] as string[] // array of SKUs
  })

  useEffect(() => {
    setFormData(prev => ({ ...prev, products: shortlistedProducts.map(p => p.sku) }))
  }, [shortlistedProducts])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1 && !formData.purpose) {
      setError('Please select a purpose / occasion.')
      return
    }
    if (step === 2 && !formData.deadline) {
      setError('Please choose a required-by date.')
      return
    }
    if (step < 3) {
      setError(null)
      setStep(step + 1)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await createPortalRequirement(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        router.push('/portal/requirements')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Create New Requirement</h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">Tell us what you need, and we&apos;ll prepare a custom quotation.</p>
      </div>

      <div className="relative mb-8 flex items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 -z-10 h-0.5 bg-gray-200"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            step >= i ? 'bg-[#1A3022] text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {i}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-0">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="border-b pb-2 text-xl font-bold text-gray-900">Step 1: What do you need?</h2>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Requirement Name</label>
                <input type="text" name="name" required value={formData.name} onChange={handleChange} className="min-h-11 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 outline-none focus:border-[#1A3022] focus:ring-1 focus:ring-[#1A3022]" placeholder="e.g. Diwali Gifts 2026" />
              </div>
              <MobileSheetSelect
                label="Purpose / Occasion"
                emptyLabel="Select an occasion"
                value={formData.purpose}
                onChange={(purpose) => setFormData({ ...formData, purpose })}
                options={PURPOSE_OPTIONS}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description (Optional)</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 outline-none focus:border-[#1A3022] focus:ring-1 focus:ring-[#1A3022]" placeholder="Any specific themes, colors, or preferences?"></textarea>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="border-b pb-2 text-xl font-bold text-gray-900">Step 2: Budget & Logistics</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Budget per unit ($)</label>
                  <input type="number" name="budget_per_unit" required value={formData.budget_per_unit} onChange={handleChange} min="1" step="0.01" className="min-h-11 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 outline-none focus:border-[#1A3022] focus:ring-1 focus:ring-[#1A3022]" placeholder="e.g. 50" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Total Quantity</label>
                  <input type="number" name="quantity" required value={formData.quantity} onChange={handleChange} min="1" className="min-h-11 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 outline-none focus:border-[#1A3022] focus:ring-1 focus:ring-[#1A3022]" placeholder="e.g. 100" />
                </div>
              </div>
              <SheetDateField
                label="Required By Date"
                value={formData.deadline}
                onChange={(deadline) => setFormData({ ...formData, deadline })}
                showDesktopLabel
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Delivery City</label>
                <input type="text" name="delivery_city" required value={formData.delivery_city} onChange={handleChange} className="min-h-11 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 outline-none focus:border-[#1A3022] focus:ring-1 focus:ring-[#1A3022]" placeholder="e.g. New York" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="border-b pb-2 text-xl font-bold text-gray-900">Step 3: Included Products</h2>
              <p className="text-sm text-gray-600">The products currently in your shortlist will be attached to this requirement for reference.</p>
              
              {shortlistedProducts.length === 0 ? (
                <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
                  You haven&apos;t shortlisted any products. We&apos;ll suggest options based on your description and budget.
                </div>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {shortlistedProducts.map(p => (
                    <li key={p.sku || p.id} className="flex items-center justify-between bg-gray-50 p-3">
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.sku}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-between">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Back
              </button>
            ) : (
              <div className="hidden sm:block"></div>
            )}
            
            <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1A3022] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#274433] disabled:opacity-50">
              {step < 3 ? 'Next Step' : loading ? 'Submitting...' : 'Submit Requirement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
