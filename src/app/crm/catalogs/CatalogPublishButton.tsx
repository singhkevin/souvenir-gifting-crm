'use client'

import { publishCatalog } from './actions'
import { ActionButton } from '@/components/ui/action-button'
import { IDEMPOTENCY_FIELD } from '@/lib/use-action'

export function CatalogPublishButton({ catalogId }: { catalogId: string }) {
  return (
    <ActionButton
      pendingLabel="Publishing…"
      successMessage="Catalog marked published."
      action={(key) => {
        const formData = new FormData()
        formData.set('campaign_id', catalogId)
        formData.set(IDEMPOTENCY_FIELD, key)
        return publishCatalog(formData).then((result) =>
          result && !result.error && result.count
            ? { ...result, message: `Published ${result.count} draft product${result.count === 1 ? '' : 's'}.` }
            : result,
        )
      }}
      className="min-h-10 rounded-lg bg-[#806A50] px-3 text-xs font-semibold text-white disabled:opacity-50"
    >
      Publish catalog
    </ActionButton>
  )
}
