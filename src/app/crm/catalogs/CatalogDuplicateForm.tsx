'use client'

import { duplicateCatalog } from './actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export function CatalogDuplicateForm({
  catalogId,
  defaultName,
  companies,
  compact = false,
}: {
  catalogId: string
  defaultName: string
  companies: { id: string; name: string }[]
  compact?: boolean
}) {
  return (
    <ActionForm
      action={duplicateCatalog}
      className={compact ? 'flex flex-col gap-2 sm:flex-row' : 'grid gap-3 rounded-2xl border bg-white p-4 text-xs md:grid-cols-3'}
      successMessage="Catalog duplicated"
    >
      <input type="hidden" name="campaign_id" value={catalogId} />
      {!compact && (
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">New catalog name</span>
          <input name="name" required defaultValue={`${defaultName} copy`} className="min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
      )}
      <label className={compact ? 'min-w-0 flex-1' : 'block space-y-1'}>
        {!compact && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Assign to company</span>
        )}
        <select name="company_id" defaultValue="" className="min-h-10 w-full rounded-lg border bg-white px-2 py-2 text-xs">
          <option value="">Leave unassigned</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
      </label>
      <SubmitButton
        pendingLabel="Duplicating…"
        className="min-h-10 rounded-lg border border-[#806A50] px-3 text-xs font-semibold text-[#806A50] disabled:opacity-50"
      >
        {compact ? 'Duplicate' : 'Duplicate catalog'}
      </SubmitButton>
    </ActionForm>
  )
}
