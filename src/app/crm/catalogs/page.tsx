import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, asRows, oneRelation } from '@/lib/utils'
import { FolderGit2 } from 'lucide-react'
import { createCatalog } from './actions'
import { CatalogForm } from './CatalogForm'
import { CompanyMultiSelect } from './CompanyMultiSelect'
import { requireStaff } from '@/lib/auth'
import { SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { SubmitButton } from '@/components/ui/submit-button'
import { catalogStatusLabel } from '@/lib/catalogs/status'

type CatalogCompany = { name: string | null }
type CatalogRow = {
  id: string
  name: string
  status?: string | null
  employee_quantity?: number | null
  budget_per_employee?: number | null
  total_budget?: number | null
  required_delivery_date?: string | null
  company_id?: string | null
  company?: CatalogCompany | CatalogCompany[] | null
}

const MAX_CHIPS = 3

export default async function CatalogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; company?: string }>
}) {
  await requireStaff(['admin', 'sales', 'management'])
  const { q = '', company: companyFilter = '' } = await searchParams
  const supabase = await createClient()
  const [{ data: catalogs }, { data: companies }] = await Promise.all([
    supabase.from('campaigns').select('*, company:companies(name)').order('created_at', { ascending: false }),
    supabase.from('companies').select('id, name').order('name'),
  ])
  const companyOptions = asRows<{ id: string; name: string }>(companies)
  const allCatalogs = asRows<CatalogRow>(catalogs)
  const ids = allCatalogs.map((row) => row.id)
  const [assignmentResult, offeringResult] = ids.length
    ? await Promise.all([
      supabase
        .from('catalog_assignments')
        .select('campaign_id, company_id, company:companies(name)')
        .in('campaign_id', ids),
      supabase
        .from('campaign_products')
        .select('campaign_id, pack_kit_role')
        .in('campaign_id', ids),
    ])
    : [{ data: [], error: null }, { data: [], error: null }]

  const assignedByCatalog = new Map<string, { id: string; name: string }[]>()
  if (!assignmentResult.error) {
    for (const row of assignmentResult.data || []) {
      const company = oneRelation(row.company as { name: string | null } | { name: string | null }[] | null)
      const list = assignedByCatalog.get(row.campaign_id) || []
      if (company?.name) list.push({ id: row.company_id as string, name: company.name })
      assignedByCatalog.set(row.campaign_id, list)
    }
  }
  // Catalogs from before assignments existed only have campaigns.company_id.
  for (const catalog of allCatalogs) {
    if (assignedByCatalog.get(catalog.id)?.length) continue
    const legacy = oneRelation(catalog.company)
    if (catalog.company_id && legacy?.name) assignedByCatalog.set(catalog.id, [{ id: catalog.company_id, name: legacy.name }])
  }
  const itemCount = new Map<string, number>()
  for (const row of offeringResult.data || []) {
    if (row.pack_kit_role === 'line') continue
    itemCount.set(row.campaign_id, (itemCount.get(row.campaign_id) || 0) + 1)
  }

  const needle = q.trim().toLowerCase()
  const catalogRows = allCatalogs.filter((catalog) => {
    if (needle && !catalog.name.toLowerCase().includes(needle)) return false
    if (companyFilter && !(assignedByCatalog.get(catalog.id) || []).some((company) => company.id === companyFilter)) return false
    return true
  })

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-8">
      <div>
        <h1 className="font-serif text-2xl font-normal text-[#1C1917]">Client Catalogs</h1>
        <p className="mt-1 text-xs text-[#7A7267]">Create a curated product set once, assign it to one or more companies, and share a link.</p>
      </div>

      <CatalogForm action={createCatalog} className="grid items-end gap-3 rounded-2xl border border-[#E5DFD5] bg-white p-5 text-xs md:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Catalog name</span>
          <input name="name" required placeholder="e.g. Diwali 2026" className="min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
        <CompanyMultiSelect companies={companyOptions} />
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Occasion</span>
          <input name="occasion" placeholder="Diwali, onboarding…" className="min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Number of employees</span>
          <input name="employee_quantity" type="number" min="1" defaultValue={1000} placeholder="e.g. 1000" className="min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Budget per person</span>
          <input name="budget_per_employee" type="number" step="0.01" min="0" defaultValue={3000} placeholder="e.g. 3000" className="min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
        <SheetDateField name="required_delivery_date" label="Required delivery" showDesktopLabel />
        <label className="block space-y-1 md:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Notes</span>
          <input name="description" placeholder="Optional notes" className="min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
        <SubmitButton pendingLabel="Creating…" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#806A50] py-2.5 font-semibold text-[#FFFFFF]">
          Create catalog
        </SubmitButton>
      </CatalogForm>

      <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search catalogs"
          aria-label="Search catalogs"
          className="min-h-10 w-full rounded-lg border border-[#E5DFD5] bg-white px-3 py-2 text-xs sm:max-w-xs"
        />
        <select
          name="company"
          defaultValue={companyFilter}
          aria-label="Filter by company"
          className="min-h-10 rounded-lg border border-[#E5DFD5] bg-white px-2 py-2 text-xs sm:max-w-xs"
        >
          <option value="">All companies</option>
          {companyOptions.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
        <button type="submit" className="min-h-10 rounded-lg border border-[#806A50] px-4 text-xs font-semibold text-[#806A50]">
          Filter
        </button>
        {(q || companyFilter) && (
          <Link href="/crm/catalogs" className="text-xs text-[#7A7267] underline">Clear</Link>
        )}
        <span className="text-xs text-[#7A7267] sm:ml-auto">
          {catalogRows.length} of {allCatalogs.length} catalog{allCatalogs.length === 1 ? '' : 's'}
        </span>
      </form>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {catalogRows.length > 0 ? (
          catalogRows.map((catalog) => {
            const assigned = assignedByCatalog.get(catalog.id) || []
            const items = itemCount.get(catalog.id) || 0
            return (
              <Link
                key={catalog.id}
                href={`/crm/catalogs/${catalog.id}`}
                className="block space-y-4 rounded-2xl border border-[#E5DFD5] bg-white p-6 transition-colors hover:border-[#806A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#806A50]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-bold text-[#1C1917]">{catalog.name}</h2>
                  <span className="shrink-0 rounded-full bg-[#E1EFFE] px-2.5 py-0.5 text-[10px] font-semibold text-[#1E429F]">
                    {catalogStatusLabel(catalog.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {assigned.length === 0 && (
                    <span className="rounded-full border border-dashed border-[#E5DFD5] px-2 py-0.5 text-[11px] text-[#7A7267]">Unassigned</span>
                  )}
                  {assigned.slice(0, MAX_CHIPS).map((company) => (
                    <span key={company.id} className="max-w-[10rem] truncate rounded-full bg-[#FAF7F2] px-2 py-0.5 text-[11px] text-[#5A5248]">
                      {company.name}
                    </span>
                  ))}
                  {assigned.length > MAX_CHIPS && (
                    <span className="rounded-full bg-[#FAF7F2] px-2 py-0.5 text-[11px] font-semibold text-[#806A50]">
                      +{assigned.length - MAX_CHIPS}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5A5248]">
                  {items} item{items === 1 ? '' : 's'} · {catalog.employee_quantity?.toLocaleString('en-IN')} employees × {formatCurrency(catalog.budget_per_employee)}
                </p>
                <p className="text-sm font-semibold">{formatCurrency(catalog.total_budget)} total</p>
                {catalog.required_delivery_date && (
                  <p className="text-[11px] text-[#7A7267]">Delivery {formatDate(catalog.required_delivery_date)}</p>
                )}
              </Link>
            )
          })
        ) : (
          <div className="col-span-full rounded-2xl border border-[#E5DFD5] bg-white p-12 text-center text-gray-500">
            <FolderGit2 className="mx-auto mb-3 h-12 w-12 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900">{allCatalogs.length ? 'No catalogs match' : 'No catalogs yet'}</h3>
          </div>
        )}
      </div>
    </div>
  )
}
