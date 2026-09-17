'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { saveCatalogueVisibility } from '@/app/crm/products/actions'
import { CompanyAvatar } from '@/components/ui/avatar'

type Company = { id: string; name: string; logo_path?: string | null }

export function CatalogueVisibilityEditor({
  productId,
  initialMode,
  companies,
  grantedIds,
}: {
  productId: string
  initialMode: string
  companies: Company[]
  grantedIds: string[]
}) {
  const [mode, setMode] = useState(initialMode === 'none' ? 'none' : initialMode === 'selected' ? 'selected' : 'all')
  const [selected, setSelected] = useState<string[]>(grantedIds)
  const [query, setQuery] = useState('')
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => c.name.toLowerCase().includes(q))
  }, [companies, query])

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const save = () => {
    startTransition(async () => {
      const result = await saveCatalogueVisibility(productId, mode, mode === 'selected' ? selected : [])
      if (result?.error) {
        toast.error('Unable to update catalogue visibility. Please try again.')
        return
      }
      toast.success('Catalogue visibility updated')
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">Catalogue visibility</h2>
        <p className="text-xs text-gray-500 mt-0.5">Show this product to:</p>
      </div>

      <div className="space-y-2">
        {[
          { value: 'all', label: 'All companies', hint: 'Every corporate client can discover this product.' },
          { value: 'selected', label: 'Selected companies', hint: 'Only the companies you choose below.' },
          { value: 'none', label: 'Not in client catalogues', hint: 'Internal team only. Existing orders are unchanged.' },
        ].map((option) => (
          <label key={option.value} className="flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="visibility-mode"
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              className="mt-1"
            />
            <span>
              <span className="block text-xs font-semibold text-gray-800">{option.label}</span>
              <span className="block text-[11px] text-gray-500">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === 'selected' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies..."
              className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg"
            />
            <button type="button" onClick={() => setSelected(filtered.map((c) => c.id))} className="text-xs text-[#806A50] hover:underline">
              Select all
            </button>
            <button type="button" onClick={() => setSelected([])} className="text-xs text-gray-500 hover:underline">
              Clear
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl divide-y">
            {filtered.map((company) => (
              <label key={company.id} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(company.id)}
                  onChange={() => toggle(company.id)}
                />
                <CompanyAvatar name={company.name} logoPath={company.logo_path} size="sm" />
                <span className="font-medium text-gray-800">{company.name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="p-3 text-xs text-gray-400">No companies match that search.</p>
            )}
          </div>
          <p className="text-[11px] text-gray-500">{selected.length} companies selected</p>
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="px-4 py-2 text-xs font-semibold text-[#FFFFFF] bg-[#806A50] hover:bg-[#9C8567] hover:text-[#FFFFFF] rounded-lg disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save visibility'}
      </button>
    </div>
  )
}
