import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, asRows, oneRelation } from '@/lib/utils'
import { FolderGit2, Building2 } from 'lucide-react'
import { createCampaign } from './actions'
import { asFormAction } from '@/lib/form-action'
import { requireStaff } from '@/lib/auth'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'

type CampaignCompany = { name: string | null }
type CampaignRow = {
  id: string
  name: string
  status?: string | null
  employee_quantity?: number | null
  budget_per_employee?: number | null
  total_budget?: number | null
  required_delivery_date?: string | null
  company?: CampaignCompany | CampaignCompany[] | null
}

export default async function CampaignsPage() {
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()
  const [{ data: campaigns }, { data: companies }] = await Promise.all([
    supabase.from('campaigns').select('*, company:companies(name)').order('created_at', { ascending: false }),
    supabase.from('companies').select('id, name').order('name'),
  ])
  const companyOptions = asRows<{ id: string; name: string }>(companies)
  const campaignRows = asRows<CampaignRow>(campaigns)

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-normal text-[#1C1917]">Campaigns & Client Projects</h1>
        <p className="text-xs text-[#7A7267] mt-1">Curate a subset of the internal catalogue, publish it to one client, and track their selections.</p>
      </div>

      <form action={asFormAction(createCampaign)} className="grid items-end gap-3 rounded-2xl border border-[#E5DFD5] bg-white p-5 text-xs md:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Campaign name</span>
          <input name="name" required placeholder="e.g. Diwali 2026" className="min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
        <MobileSheetSelect
          name="company_id"
          label="Client company"
          required
          showDesktopLabel
          emptyLabel="Select company"
          options={[
            { value: '', label: 'Select company' },
            ...companyOptions.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })),
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
        <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1A3022] py-2.5 font-semibold text-white">
          Create campaign
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaignRows.length > 0 ? (
          campaignRows.map((camp: CampaignRow) => {
            const company = oneRelation(camp.company)
            return (
              <Link key={camp.id} href={`/crm/campaigns/${camp.id}`} className="bg-white rounded-2xl border border-[#E5DFD5] p-6 space-y-4 hover:border-[#1A3022]">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#1C1917]">{camp.name}</h3>
                    <p className="text-xs text-[#7A7267] flex items-center gap-1 mt-1">
                      <Building2 className="w-3.5 h-3.5" /> {company?.name || 'Client company'}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E1EFFE] text-[#1E429F]">
                    {String(camp.status || 'planning').replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-[#5A5248]">
                  {camp.employee_quantity?.toLocaleString('en-IN')} employees · {formatCurrency(camp.budget_per_employee)} / person
                </p>
                <p className="text-sm font-semibold">{formatCurrency(camp.total_budget)} total</p>
                {camp.required_delivery_date && (
                  <p className="text-[11px] text-[#7A7267]">Delivery {formatDate(camp.required_delivery_date)}</p>
                )}
              </Link>
            )
          })
        ) : (
          <div className="col-span-full bg-white rounded-2xl border border-[#E5DFD5] p-12 text-center text-gray-500">
            <FolderGit2 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <h3 className="text-base font-semibold text-gray-900">No campaigns yet</h3>
          </div>
        )}
      </div>
    </div>
  )
}
