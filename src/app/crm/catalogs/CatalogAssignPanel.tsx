'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { assignCatalogCompany, unassignCatalogCompany } from './actions'

export function CatalogAssignPanel({
  catalogId,
  assigned,
  companies,
  pricingCompanyName,
}: {
  catalogId: string
  assigned: { companyId: string; name: string }[]
  companies: { id: string; name: string }[]
  pricingCompanyName: string | null
}) {
  const [pending, startTransition] = useTransition()
  const assignedIds = new Set(assigned.map((row) => row.companyId))
  const available = companies.filter((company) => !assignedIds.has(company.id))

  const run = (
    action: (formData: FormData) => Promise<{ error?: string; success?: boolean } | undefined>,
    companyId: string,
  ) => {
    const formData = new FormData()
    formData.set('campaign_id', catalogId)
    formData.set('company_id', companyId)
    startTransition(async () => {
      const result = await action(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      window.location.reload()
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-white p-4 text-xs">
      <div>
        <h2 className="font-serif text-base text-[#1C1917]">Assigned companies</h2>
        <p className="mt-1 text-[#7A7267]">
          One catalog can be shared with several companies. The portal list uses these assignments.
          {pricingCompanyName ? ` Sell-price defaults use ${pricingCompanyName}.` : ' Assign a company before generating budget packs.'}
        </p>
      </div>
      <ul className="space-y-2">
        {assigned.length === 0 && <li className="text-[#7A7267]">Not assigned yet. The catalog stays in the CRM until you share it.</li>}
        {assigned.map((row) => (
          <li key={row.companyId} className="flex items-center justify-between gap-3 rounded-lg border border-[#E5DFD5] px-3 py-2">
            <span className="font-semibold text-[#1C1917]">{row.name}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(unassignCatalogCompany, row.companyId)}
              className="underline text-red-700 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            const companyId = String(new FormData(event.currentTarget).get('company_id') || '')
            if (!companyId) return
            run(assignCatalogCompany, companyId)
          }}
        >
          <select name="company_id" required className="min-h-10 flex-1 rounded-lg border px-2 py-2" defaultValue="">
            <option value="" disabled>Add a company</option>
            {available.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-[#806A50] px-3 font-semibold text-white disabled:opacity-50">
            {pending ? 'Saving…' : 'Assign'}
          </button>
        </form>
      )}
    </div>
  )
}
