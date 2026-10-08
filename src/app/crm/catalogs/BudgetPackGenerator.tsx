'use client'

import { useState } from 'react'
import { generateBudgetPackOptions, publishBudgetPackOptions } from './actions'
import { Spinner } from '@/components/ui/submit-button'
import { formatCurrency } from '@/lib/utils'
import { IDEMPOTENCY_FIELD, useAction, useIdempotencyKey } from '@/lib/use-action'

type Which = 'generate' | 'replace' | 'publish'

export function BudgetPackGenerator({
  catalogId,
  budgetPerEmployee,
  draftPackCount,
  publishedPackCount,
  companies,
  defaultCompanyId,
}: {
  catalogId: string
  budgetPerEmployee: number | null
  draftPackCount: number
  publishedPackCount: number
  /** Assigned companies; packs are priced against the chosen one. */
  companies: { id: string; name: string }[]
  defaultCompanyId: string | null
}) {
  const { pending, run } = useAction()
  const [active, setActive] = useState<Which | null>(null)
  const [pricingCompanyId, setPricingCompanyId] = useState(
    companies.some((company) => company.id === defaultCompanyId) ? defaultCompanyId || '' : companies[0]?.id || '',
  )
  const generateKey = useIdempotencyKey()
  const replaceKey = useIdempotencyKey()
  const publishKey = useIdempotencyKey()

  const runGenerate = (replace: boolean) => {
    const idem = replace ? replaceKey : generateKey
    const formData = new FormData()
    formData.set('campaign_id', catalogId)
    if (replace) formData.set('replace', '1')
    formData.set('pricing_company_id', pricingCompanyId)
    formData.set(IDEMPOTENCY_FIELD, idem.key)
    setActive(replace ? 'replace' : 'generate')
    run(
      async () => {
        const result = await generateBudgetPackOptions(formData)
        if (result && !result.error) {
          return { ...result, message: `Generated ${result.count} budget kit option${result.count === 1 ? '' : 's'} (draft).` }
        }
        return result
      },
      { onSuccess: idem.rotate },
    )
  }

  const runPublish = () => {
    const formData = new FormData()
    formData.set('campaign_id', catalogId)
    formData.set(IDEMPOTENCY_FIELD, publishKey.key)
    setActive('publish')
    run(
      async () => {
        const result = await publishBudgetPackOptions(formData)
        if (result && !result.error) {
          return { ...result, message: `Published ${result.count} option${result.count === 1 ? '' : 's'} to the client portal.` }
        }
        return result
      },
      { onSuccess: publishKey.rotate },
    )
  }

  const label = (which: Which, text: string, pendingText: string) =>
    pending && active === which ? (
      <span className="inline-flex items-center justify-center gap-2">
        <Spinner />
        {pendingText}
      </span>
    ) : (
      text
    )

  const budget = budgetPerEmployee || 0

  return (
    <div className="space-y-3 rounded-2xl border border-[#E5DFD5] bg-[#FAF7F2] p-4 text-xs">
      <div>
        <h2 className="font-serif text-base text-[#1C1917]">Budget pack generator</h2>
        <p className="mt-1 text-[#7A7267]">
          Build Option A / B / C as multi-item kits (2–4 products per person, e.g. mug + notebook + bag) using
          the pricing company&apos;s catalogue and margin. Each kit&apos;s combined price stays at or under{' '}
          {budget > 0 ? formatCurrency(budget) : 'the catalog budget'} per person. Generate always
          refreshes draft packs; use Replace all packs if published kits should be rebuilt too.
        </p>
      </div>
      <label className="flex flex-wrap items-center gap-2 text-[#5A5248]">
        Price packs for
        <select
          value={pricingCompanyId}
          onChange={(event) => setPricingCompanyId(event.target.value)}
          disabled={pending || companies.length === 0}
          className="min-h-10 rounded-lg border bg-white px-2 py-2"
        >
          {companies.length === 0 && <option value="">Assign a company first</option>}
          {companies.map((company) => (
            <option key={company.id} value={company.id}>{company.name}</option>
          ))}
        </select>
        <span className="text-[#7A7267]">Pack prices are fixed at the chosen company&apos;s margin.</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || budget <= 0 || !pricingCompanyId}
          aria-busy={pending && active === 'generate' ? true : undefined}
          onClick={() => runGenerate(false)}
          className="min-h-10 rounded-lg bg-[#806A50] px-3 font-semibold text-white disabled:opacity-50"
        >
          {label('generate', 'Generate options', 'Generating…')}
        </button>
        <button
          type="button"
          disabled={pending || budget <= 0 || !pricingCompanyId}
          aria-busy={pending && active === 'replace' ? true : undefined}
          onClick={() => runGenerate(true)}
          className="min-h-10 rounded-lg border border-[#E5DFD5] bg-white px-3 font-semibold text-[#806A50] disabled:opacity-50"
        >
          {label('replace', 'Replace all packs', 'Replacing…')}
        </button>
        <button
          type="button"
          disabled={pending || draftPackCount === 0}
          aria-busy={pending && active === 'publish' ? true : undefined}
          onClick={runPublish}
          className="min-h-10 rounded-lg border border-[#806A50] px-3 font-semibold text-[#806A50] disabled:opacity-50"
        >
          {label('publish', `Publish all pack drafts (${draftPackCount})`, 'Publishing…')}
        </button>
      </div>
      {budget <= 0 && (
        <p className="text-amber-800">Save a budget per person on this catalog before generating.</p>
      )}
      {publishedPackCount > 0 && (
        <p className="text-[#5A5248]">{publishedPackCount} pack option(s) already published for client review.</p>
      )}
    </div>
  )
}
