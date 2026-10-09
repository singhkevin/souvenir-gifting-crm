'use client'

import { duplicateCatalog } from './actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { duplicateCatalogName } from '@/lib/catalogs/names'

/** Reuse this product set for a new occasion. The copy starts unassigned and in draft. */
export function CatalogDuplicateForm({ catalogId, defaultName }: { catalogId: string; defaultName: string }) {
  return (
    <ActionForm
      action={duplicateCatalog}
      className="grid items-end gap-3 rounded-2xl border bg-white p-4 text-xs md:grid-cols-[1fr_auto]"
      successMessage="Catalog duplicated"
    >
      <input type="hidden" name="campaign_id" value={catalogId} />
      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">New catalog name</span>
        <input
          name="name"
          required
          defaultValue={duplicateCatalogName(defaultName)}
          className="min-h-11 w-full rounded-lg border px-3 py-2"
        />
        <span className="block text-[11px] text-[#7A7267]">
          Copies the products and prices of this catalog into a new draft. Assign companies afterwards.
        </span>
      </label>
      <SubmitButton
        pendingLabel="Duplicating…"
        className="min-h-11 rounded-lg border border-[#806A50] px-4 text-xs font-semibold text-[#806A50] disabled:opacity-50"
      >
        Duplicate as new catalog
      </SubmitButton>
    </ActionForm>
  )
}
