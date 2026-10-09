'use client'

import { publishCatalog } from './actions'
import { ActionButton } from '@/components/ui/action-button'
import { IDEMPOTENCY_FIELD } from '@/lib/use-action'

/**
 * Publish is offered only while there are unpublished items. Once everything is live it shows a
 * disabled "Published" badge instead, so a published catalog can't be "published" again.
 */
export function CatalogPublishButton({
  catalogId,
  draftCount,
  published,
}: {
  catalogId: string
  draftCount: number
  published: boolean
}) {
  if (draftCount === 0) {
    return published ? (
      <span
        aria-disabled="true"
        className="inline-flex min-h-10 items-center rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-800"
      >
        Published
      </span>
    ) : null
  }
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
      {published ? `Publish ${draftCount} new item${draftCount === 1 ? '' : 's'}` : 'Publish catalog'}
    </ActionButton>
  )
}
