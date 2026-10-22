'use client'

import { useMemo, useState } from 'react'
import { Briefcase, Building2, EyeOff, Store } from 'lucide-react'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { saveChannelVisibility, unhideCompanyProduct } from '@/app/crm/products/actions'
import { CompanyAvatar } from '@/components/ui/avatar'
import { CHANNEL_MIGRATION } from '@/lib/products/channel-visibility'

type Company = { id: string; name: string; logo_path?: string | null }
export type HiddenCompany = Company & { hiddenAt?: string | null }

function formatHiddenAt(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' IST'
}

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
  hiddenFrom = [],
}: {
  productId: string
  initialMode: string
  initialStore: boolean
  initialBusiness: boolean
  channelsReady: boolean
  companies: Company[]
  grantedIds: string[]
  hiddenFrom?: HiddenCompany[]
}) {
  const [store, setStore] = useState(initialStore)
  const [business, setBusiness] = useState(initialBusiness)
  const [mode, setMode] = useState(initialMode === 'none' ? 'none' : initialMode === 'selected' ? 'selected' : 'all')
  const [selected, setSelected] = useState<string[]>(grantedIds)
  const [query, setQuery] = useState('')
  const { pending, run } = useAction()
  const [unhidingId, setUnhidingId] = useState<string | null>(null)
  const hiddenIds = useMemo(() => new Set(hiddenFrom.map((c) => c.id)), [hiddenFrom])

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
    let clearExclusions = false
    if (mode === 'all' && hiddenFrom.length > 0) {
      const names = hiddenFrom.map((c) => c.name).join(', ')
      // Default (Cancel) keeps the hide rules; OK clears them.
      clearExclusions = window.confirm(
        `This product is hidden from ${hiddenFrom.length} ${hiddenFrom.length === 1 ? 'company' : 'companies'}: ${names}.\n\n` +
          'Hide rules override "All companies".\n\n' +
          'OK: clear these hide rules so every company sees it.\n' +
          'Cancel: keep them hidden from these companies.',
      )
    }
    const unhidesTicked = mode === 'selected' && selected.some((id) => hiddenIds.has(id))
    run(
      async () => saveChannelVisibility(productId, {
        store: storeValue,
        business: businessValue,
        corporate: mode,
        companyIds: mode === 'selected' ? selected : [],
        clearExclusions,
      }),
      {
        successMessage:
          clearExclusions || unhidesTicked ? 'Visibility updated and hide rules cleared' : 'Visibility updated',
      },
    )
  }

  const unhide = (company: HiddenCompany) => {
    setUnhidingId(company.id)
    run(async () => unhideCompanyProduct(productId, company.id), {
      successMessage: `Unhidden for ${company.name}`,
    })
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

      {hiddenFrom.length > 0 && (
        <div className="space-y-2 border border-[#9E4300]/30 bg-[#FFB690]/15 p-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#9E4300]">
              <EyeOff className="h-3.5 w-3.5" /> Hidden from these companies
            </h3>
            <p className="text-[11px] text-[#7C766F] mt-0.5">
              A hide rule overrides the corporate setting above. These companies do not see this product on their portal or microsite.
            </p>
          </div>
          <ul className="divide-y divide-[#EDE8DF] border border-[#CCC5BD] bg-white">
            {hiddenFrom.map((company) => {
              const when = formatHiddenAt(company.hiddenAt)
              const busy = pending && unhidingId === company.id
              return (
                <li key={company.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <CompanyAvatar name={company.name} logoPath={company.logo_path} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-[#1C1B1A] truncate">{company.name}</span>
                    {when && <span className="block text-[10px] text-[#7C766F]">Hidden {when}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => unhide(company)}
                    disabled={pending}
                    className="shrink-0 border border-[#9E4300]/40 px-2.5 py-1 text-[11px] font-semibold text-[#9E4300] hover:bg-[#9E4300]/10 disabled:opacity-50"
                  >
                    {busy ? (
                      <span className="inline-flex items-center gap-1.5"><Spinner />Unhiding…</span>
                    ) : (
                      'Unhide'
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

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
                {hiddenIds.has(company.id) && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9E4300]">
                    {selected.includes(company.id) ? 'Hidden · unhides on save' : 'Hidden'}
                  </span>
                )}
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
