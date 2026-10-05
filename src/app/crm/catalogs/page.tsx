import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, asRows, oneRelation } from '@/lib/utils'
import { FolderGit2, Building2 } from 'lucide-react'
import { createCatalog } from './actions'
import { CatalogForm } from './CatalogForm'
import { requireStaff } from '@/lib/auth'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { catalogStatusLabel } from '@/lib/catalogs/status'
import { CatalogDuplicateForm } from './CatalogDuplicateForm'

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

export default async function CatalogsPage() {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const [{ data: catalogs }, { data: companies }] = await Promise.all([
    supabase.from('campaigns').select('*, company:companies(name)').order('created_at', { ascending: false }),
    supabase.from('companies').select('id, name').order('name'),
  ])
  const companyOptions = asRows<{ id: string; name: string }>(companies)
  const catalogRows = asRows<CatalogRow>(catalogs)
  const ids = catalogRows.map((row) => row.id)
  const assignmentResult = ids.length
    ? await supabase
      .from('catalog_assignments')
      .select('campaign_id, company:companies(name)')
      .in('campaign_id', ids)
    : { data: [], error: null }
  const namesByCatalog = new Map<string, string[]>()
  if (!assignmentResult.error) {
    for (const row of assignmentResult.data || []) {
      const company = oneRelation(row.company as { name: string | null } | { name: string | null }[] | null)
      const list = namesByCatalog.get(row.campaign_id) || []
      if (company?.name) list.push(company.name)
      namesByCatalog.set(row.campaign_id, list)
    }
  }

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
        <MobileSheetSelect
          name="company_id"
          label="Assign to company"
          showDesktopLabel
          emptyLabel="Unassigned"
          options={[
            { value: '', label: 'Unassigned' },
            ...companyOptions.map((company) => ({ value: company.id, label: company.name })),
          ]}
        />
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
        <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#806A50] py-2.5 font-semibold text-[#FFFFFF]">
          Create catalog
        </button>
      </CatalogForm>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {catalogRows.length > 0 ? (
          catalogRows.map((catalog) => {
            const company = oneRelation(catalog.company)
            const assignedNames = namesByCatalog.get(catalog.id) || []
            const companyLabel = assignedNames.length
              ? assignedNames.join(', ')
              : company?.name || 'Unassigned'
            return (
              <div key={catalog.id} className="space-y-4 rounded-2xl border border-[#E5DFD5] bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/crm/catalogs/${catalog.id}`} className="text-base font-bold text-[#1C1917] hover:underline">
                      {catalog.name}
                    </Link>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#7A7267]">
                      <Building2 className="h-3.5 w-3.5" /> {companyLabel}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#E1EFFE] px-2.5 py-0.5 text-[10px] font-semibold text-[#1E429F]">
                    {catalogStatusLabel(catalog.status)}
                  </span>
                </div>
                <p className="text-xs text-[#5A5248]">
                  {catalog.employee_quantity?.toLocaleString('en-IN')} employees · {formatCurrency(catalog.budget_per_employee)} / person
                </p>
                <p className="text-sm font-semibold">{formatCurrency(catalog.total_budget)} total</p>
                {catalog.required_delivery_date && (
                  <p className="text-[11px] text-[#7A7267]">Delivery {formatDate(catalog.required_delivery_date)}</p>
                )}
                <CatalogDuplicateForm
                  compact
                  catalogId={catalog.id}
                  defaultName={catalog.name}
                  companies={companyOptions}
                />
              </div>
            )
          })
        ) : (
          <div className="col-span-full rounded-2xl border border-[#E5DFD5] bg-white p-12 text-center text-gray-500">
            <FolderGit2 className="mx-auto mb-3 h-12 w-12 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900">No catalogs yet</h3>
          </div>
        )}
      </div>
    </div>
  )
}
