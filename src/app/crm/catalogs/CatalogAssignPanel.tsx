'use client'

import { useRef, useState } from 'react'
import { assignCatalogCompany, unassignCatalogCompany } from './actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton, Spinner } from '@/components/ui/submit-button'
import { IDEMPOTENCY_FIELD, newIdempotencyKey, useAction } from '@/lib/use-action'

export function CatalogAssignPanel({
  catalogId,
  assigned,
  companies,
  defaultCompanyName,
}: {
  catalogId: string
  assigned: { companyId: string; name: string }[]
  companies: { id: string; name: string }[]
  /** Company whose margin prices newly added lines and the default preview (campaigns.company_id). */
  defaultCompanyName: string | null
}) {
  const { pending, run } = useAction()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const keys = useRef(new Map<string, string>())
  const assignedIds = new Set(assigned.map((row) => row.companyId))
  const available = companies.filter((company) => !assignedIds.has(company.id))

  const remove = (companyId: string) => {
    let key = keys.current.get(companyId)
    if (!key) {
      key = newIdempotencyKey()
      keys.current.set(companyId, key)
    }
    const formData = new FormData()
    formData.set('campaign_id', catalogId)
    formData.set('company_id', companyId)
    formData.set(IDEMPOTENCY_FIELD, key)
    setRemovingId(companyId)
    run(() => unassignCatalogCompany(formData), {
      successMessage: 'Company removed',
      onSuccess: () => keys.current.delete(companyId),
    })
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-white p-4 text-xs">
      <div>
        <h2 className="font-serif text-base text-[#1C1917]">Assigned companies</h2>
        <p className="mt-1 text-[#7A7267]">
          One catalog can be shared with several companies. The portal list uses these assignments, and each
          company sees prices worked out from its own margin (unless a line has a manual price).
          {defaultCompanyName ? ` Default preview and new lines use ${defaultCompanyName}.` : ' Assign a company to preview prices and generate budget packs.'}
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
              aria-busy={pending && removingId === row.companyId ? true : undefined}
              onClick={() => remove(row.companyId)}
              className="underline text-red-700 disabled:opacity-50"
            >
              {pending && removingId === row.companyId ? (
                <span className="inline-flex items-center gap-2 no-underline">
                  <Spinner />
                  Removing…
                </span>
              ) : (
                'Remove'
              )}
            </button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <ActionForm
          action={assignCatalogCompany}
          className="flex flex-col gap-2 sm:flex-row"
          successMessage="Company assigned"
          resetOnSuccess
        >
          <input type="hidden" name="campaign_id" value={catalogId} />
          <select name="company_id" required className="min-h-10 flex-1 rounded-lg border px-2 py-2" defaultValue="">
            <option value="" disabled>Add a company</option>
            {available.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <SubmitButton pendingLabel="Assigning…" className="min-h-10 rounded-lg bg-[#806A50] px-3 font-semibold text-white disabled:opacity-50">
            Assign
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  )
}
