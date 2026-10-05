'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { publishCatalog } from './actions'

export function CatalogPublishButton({ catalogId }: { catalogId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const formData = new FormData()
        formData.set('campaign_id', catalogId)
        startTransition(async () => {
          const result = await publishCatalog(formData)
          if (result?.error) {
            toast.error(result.error)
            return
          }
          toast.success(
            result.count
              ? `Published ${result.count} draft product${result.count === 1 ? '' : 's'}.`
              : 'Catalog marked published.',
          )
          window.location.reload()
        })
      }}
      className="min-h-10 rounded-lg bg-[#806A50] px-3 text-xs font-semibold text-white disabled:opacity-50"
    >
      {pending ? 'Publishing…' : 'Publish catalog'}
    </button>
  )
}
