'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { generateBudgetPackOptions, publishBudgetPackOptions } from './actions'
import { formatCurrency } from '@/lib/utils'

export function BudgetPackGenerator({
  campaignId,
  budgetPerEmployee,
  draftPackCount,
  publishedPackCount,
}: {
  campaignId: string
  budgetPerEmployee: number | null
  draftPackCount: number
  publishedPackCount: number
}) {
  const [pending, startTransition] = useTransition()

  const runGenerate = (replace: boolean) => {
    const formData = new FormData()
    formData.set('campaign_id', campaignId)
    if (replace) formData.set('replace', '1')
    startTransition(async () => {
      const result = await generateBudgetPackOptions(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        `Generated ${result.count} budget kit option${result.count === 1 ? '' : 's'} (draft).`
      )
      window.location.reload()
    })
  }

  const runPublish = () => {
    const formData = new FormData()
    formData.set('campaign_id', campaignId)
    startTransition(async () => {
      const result = await publishBudgetPackOptions(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Published ${result.count} option${result.count === 1 ? '' : 's'} to the client portal.`)
      window.location.reload()
    })
  }

  const budget = budgetPerEmployee || 0

  return (
    <div className="rounded-2xl border border-[#E5DFD5] bg-[#FAF7F2] p-4 text-xs space-y-3">
      <div>
        <h2 className="font-serif text-base text-[#1C1917]">Budget pack generator</h2>
        <p className="mt-1 text-[#7A7267]">
          Build Option A / B / C as multi-item kits (2–4 products per person, e.g. mug + notebook + bag) using
          this company&apos;s catalogue and margin. Each kit&apos;s combined price stays at or under{' '}
          {budget > 0 ? formatCurrency(budget) : 'the campaign budget'} per person. Generate always
          refreshes draft packs; use Replace all packs if published kits should be rebuilt too.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || budget <= 0}
          onClick={() => runGenerate(false)}
          className="min-h-10 rounded-lg bg-[#806A50] px-3 font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Working…' : 'Generate options'}
        </button>
        <button
          type="button"
          disabled={pending || budget <= 0}
          onClick={() => runGenerate(true)}
          className="min-h-10 rounded-lg border border-[#E5DFD5] bg-white px-3 font-semibold text-[#806A50] disabled:opacity-50"
        >
          Replace all packs
        </button>
        <button
          type="button"
          disabled={pending || draftPackCount === 0}
          onClick={runPublish}
          className="min-h-10 rounded-lg border border-[#806A50] px-3 font-semibold text-[#806A50] disabled:opacity-50"
        >
          Publish all pack drafts ({draftPackCount})
        </button>
      </div>
      {budget <= 0 && (
        <p className="text-amber-800">Save a budget per person on this campaign before generating.</p>
      )}
      {publishedPackCount > 0 && (
        <p className="text-[#5A5248]">{publishedPackCount} pack option(s) already published for client review.</p>
      )}
    </div>
  )
}
