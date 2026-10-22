'use client'

import { useMemo, useState } from 'react'
import { Briefcase, Building2, Store } from 'lucide-react'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { saveChannelVisibility } from '@/app/crm/products/actions'
import { CompanyAvatar } from '@/components/ui/avatar'
import { CHANNEL_MIGRATION } from '@/lib/products/channel-visibility'

type Company = { id: string; name: string; logo_path?: string | null }

const CORPORATE_OPTIONS = [
  { value: 'all', label: 'All companies', hint: 'Every corporate client portal, client catalogue and microsite.' },
  { value: 'selected', label: 'Selected companies', hint: 'Only the corporate clients you choose below.' },
  { value: 'none', label: 'None', hint: 'No corporate portal or microsite. Existing orders are unchanged.' },
] as const

export function ChannelSwitch({
  name,
  checked,
  onChange,
  disabled,
  icon,
  title,
  hint,
}: {
  name: string
  checked: boolean
  onChange?: (value: boolean) => void
  disabled?: boolean
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <label
      className={`flex items-start gap-3 border border-[#CCC5BD] bg-white p-3.5 rounded-none ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-[#9E4300]'} transition-colors`}
    >
      <input
        type="checkbox"
        name={name}
        checked={onChange ? checked : undefined}
        defaultChecked={onChange ? undefined : checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 accent-[#9E4300]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A]">
          {icon}
          {title}
        </span>
        <span className="mt-1 block text-[11px] text-[#7C766F]">{hint}</span>
      </span>
    </label>
  )
}

export function CatalogueVisibilityEditor({
  productId,
  initialMode,
  initialStore,
  initialBusiness,
  channelsReady,
  companies,
  grantedIds,
}: {
  productId: string
  initialMode: string
  initialStore: boolean
  initialBusiness: boolean
  channelsReady: boolean
  companies: Company[]
  grantedIds: string[]
}) {
  const [store, setStore] = useState(initialStore)
  const [business, setBusiness] = useState(initialBusiness)
  const [mode, setMode] = useState(initialMode === 'none' ? 'none' : initialMode === 'selected' ? 'selected' : 'all')
  const [selected, setSelected] = useState<string[]>(grantedIds)
  const [query, setQuery] = useState('')
  const { pending, run } = useAction()

  // Before the migration, Retail and Business follow corporate "All companies".
  const legacy = mode === 'all'
  const storeValue = channelsReady ? store : legacy
  const businessValue = channelsReady ? business : legacy

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => c.name.toLowerCase().includes(q))
  }, [companies, query])

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const save = () => {
    run(
      async () => saveChannelVisibility(productId, {
        store: storeValue,
        business: businessValue,
        corporate: mode,
        companyIds: mode === 'selected' ? selected : [],
      }),
      { successMessage: 'Visibility updated' },
    )
  }

  return (
    <fieldset disabled={pending} aria-busy={pending || undefined} className="space-y-5 min-w-0 border-0 p-0 m-0">
      <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6">
        <h2 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">Where this product shows</h2>
        <p className="text-xs text-[#7C766F] mt-0.5">Each channel is switched on or off on its own.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChannelSwitch
          name="show_in_store"
          checked={storeValue}
          onChange={setStore}
          disabled={!channelsReady}
          icon={<Store className="h-3.5 w-3.5 text-[#9E4300]" />}
          title="Retail store"
          hint="Public store, catalogue, search and homepage."
        />
        <ChannelSwitch
          name="show_in_business"
          checked={businessValue}
          onChange={setBusiness}
          disabled={!channelsReady}
          icon={<Briefcase className="h-3.5 w-3.5 text-[#9E4300]" />}
          title="Business portal"
          hint="/business, for registered non-corporate businesses."
        />
      </div>
      {!channelsReady && (
        <p className="text-[11px] text-[#9E4300]">
          Retail and Business follow &ldquo;All companies&rdquo; until {CHANNEL_MIGRATION} is applied.
        </p>
      )}

      <div className="space-y-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A]">
            <Building2 className="h-3.5 w-3.5 text-[#9E4300]" /> Corporate visibility
          </h3>
          <p className="text-[11px] text-[#7C766F] mt-0.5">
            Corporate /portal, client catalogues and microsites only. It does not change the retail store.
          </p>
        </div>
        {CORPORATE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-3 border border-[#CCC5BD] bg-white p-3 rounded-none cursor-pointer hover:border-[#9E4300] transition-colors"
          >
            <input
              type="radio"
              name="visibility-mode"
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              className="mt-1 accent-[#9E4300]"
            />
            <span>
              <span className="block text-xs font-semibold text-[#1C1B1A]">{option.label}</span>
              <span className="block text-[11px] text-[#7C766F]">{option.hint}</span>
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
              className="flex-1 px-3 py-2 text-xs border border-[#CCC5BD] rounded-none bg-white"
            />
            <button type="button" onClick={() => setSelected(filtered.map((c) => c.id))} className="text-xs text-[#9E4300] hover:underline">
              Select all
            </button>
            <button type="button" onClick={() => setSelected([])} className="text-xs text-[#7C766F] hover:underline">
              Clear
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto border border-[#CCC5BD] bg-white divide-y divide-[#EDE8DF]">
            {filtered.map((company) => (
              <label key={company.id} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-[#F6F3EC] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(company.id)}
                  onChange={() => toggle(company.id)}
                  className="accent-[#9E4300]"
                />
                <CompanyAvatar name={company.name} logoPath={company.logo_path} size="sm" />
                <span className="font-medium text-[#1C1B1A]">{company.name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="p-3 text-xs text-[#7C766F]">No companies match that search.</p>
            )}
          </div>
          <p className="text-[11px] text-[#7C766F]">{selected.length} companies selected</p>
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="w-full py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] bg-[#1C1B1A] hover:bg-[#9E4300] rounded-none transition-colors disabled:opacity-50"
      >
        {pending ? (
          <span className="inline-flex items-center gap-2"><Spinner />Saving…</span>
        ) : (
          'Save visibility'
        )}
      </button>
    </fieldset>
  )
}
