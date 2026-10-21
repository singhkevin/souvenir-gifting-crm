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
import { companyHint, companyListLabel, dedupeById } from '@/lib/catalogs/company-option'

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
    supabase.from('companies').select('id, name, portal_slug, allowed_email_domains, gst_number').order('name'),
  ])
  const companyOptions = dedupeById(
    asRows<{ id: string; name: string; portal_slug?: string | null; allowed_email_domains?: string[] | null; gst_number?: string | null }>(companies).map((company) => ({
      id: company.id,
      name: company.name,
      hint: companyHint(company),
    })),
  )
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
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
          Client Catalogs
        </h1>
        <p className="mt-1 text-xs text-[#4A4640]">
          Create a product set once, assign it to one or more companies, and share a link.
        </p>
      </div>

      <CatalogForm action={createCatalog} className="space-y-3 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4 text-xs">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Catalog name</span>
            <input
              name="name"
              required
              placeholder="e.g. Diwali 2026"
              className="min-h-9 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Occasion</span>
            <input
              name="occasion"
              placeholder="Diwali, onboarding…"
              className="min-h-9 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Number of employees</span>
            <input
              name="employee_quantity"
              type="number"
              min="1"
              defaultValue={1000}
              placeholder="e.g. 1000"
              className="min-h-9 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 font-mono text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Budget per person</span>
            <input
              name="budget_per_employee"
              type="number"
              step="0.01"
              min="0"
              defaultValue={3000}
              placeholder="e.g. 3000"
              className="min-h-9 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 font-mono text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </label>
          <SheetDateField name="required_delivery_date" label="Required delivery" showDesktopLabel />
        </div>
        <CompanyMultiSelect companies={companyOptions} />
        <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Notes</span>
            <input
              name="description"
              placeholder="Optional notes"
              className="min-h-9 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </label>
          <SubmitButton
            pendingLabel="Creating…"
            className="inline-flex min-h-9 items-center justify-center rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
          >
            Create catalog
          </SubmitButton>
        </div>
      </CatalogForm>

      <form method="get" className="flex flex-col gap-2 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3 sm:flex-row sm:items-center" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search catalogs..."
          aria-label="Search catalogs"
          className="min-h-9 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 sm:max-w-xs"
        />
        <select
          name="company"
          defaultValue={companyFilter}
          aria-label="Filter by company"
          className="min-h-9 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 sm:max-w-xs"
        >
          <option value="">All companies</option>
          {companyOptions.map((company) => (
            <option key={company.id} value={company.id}>{companyListLabel(company)}</option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-9 shrink-0 rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
        >
          Filter
        </button>
        {(q || companyFilter) && (
          <Link
            href="/crm/catalogs"
            className="text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A] transition-colors hover:text-[#9E4300]"
          >
            Clear
          </Link>
        )}
        <span className="text-xs text-[#7C766F] sm:ml-auto">
          <span className="font-mono">{catalogRows.length}</span> of <span className="font-mono">{allCatalogs.length}</span> catalog{allCatalogs.length === 1 ? '' : 's'}
        </span>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {catalogRows.length > 0 ? (
          catalogRows.map((catalog) => {
            const assigned = assignedByCatalog.get(catalog.id) || []
            const items = itemCount.get(catalog.id) || 0
            return (
              <Link
                key={catalog.id}
                href={`/crm/catalogs/${catalog.id}`}
                className="group block space-y-3 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-5 transition-colors hover:border-[#1C1B1A]"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-[family-name:var(--font-newsreader)] text-xl font-normal leading-snug text-[#1C1B1A] transition-colors group-hover:text-[#9E4300]">
                    {catalog.name}
                  </h2>
                  <span className="shrink-0 rounded-none border border-[#CCC5BD] px-2 py-0.5 text-[10px] uppercase text-[#4A4640]">
                    {catalogStatusLabel(catalog.status)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {assigned.length === 0 && (
                    <span className="rounded-none border border-dashed border-[#CCC5BD] px-2 py-0.5 text-[11px] text-[#7C766F]">
                      Unassigned
                    </span>
                  )}
                  {assigned.slice(0, MAX_CHIPS).map((company) => (
                    <span key={company.id} className="max-w-[10rem] truncate rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-0.5 text-[11px] text-[#4A4640]">
                      {company.name}
                    </span>
                  ))}
                  {assigned.length > MAX_CHIPS && (
                    <span className="rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#9E4300]">
                      +{assigned.length - MAX_CHIPS}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#4A4640]">
                  <span className="font-mono">{items}</span> item{items === 1 ? '' : 's'} · <span className="font-mono">{catalog.employee_quantity?.toLocaleString('en-IN')}</span> employees × <span className="font-mono">{formatCurrency(catalog.budget_per_employee)}</span>
                </p>
                <p className="font-mono text-sm font-semibold text-[#1C1B1A]">
                  {formatCurrency(catalog.total_budget)} total
                </p>
                {catalog.required_delivery_date && (
                  <p className="text-[11px] text-[#7C766F]">
                    Delivery <span className="font-mono">{formatDate(catalog.required_delivery_date)}</span>
                  </p>
                )}
              </Link>
            )
          })
        ) : (
          <div className="col-span-full rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-12 text-center text-xs text-[#7C766F]">
            <FolderGit2 className="mx-auto mb-3 h-10 w-10 text-[#7C766F]" />
            <h3 className="text-sm font-semibold text-[#1C1B1A]">
              {allCatalogs.length ? 'No catalogs match' : 'No catalogs yet'}
            </h3>
          </div>
        )}
      </div>
    </div>
  )
}
