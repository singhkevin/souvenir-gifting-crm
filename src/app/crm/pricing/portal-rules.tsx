'use client'

import { useMemo, useState } from 'react'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  gstPriceNote,
  PORTAL_LABEL,
  resolvePortalPrice,
  type GstMode,
  type PortalRule,
  type PricingPortal,
  type RoundingMode,
} from '@/lib/pricing/engine'
import { COST_SOURCE_LABEL, RESOLVED_COST_SOURCES, type ResolvedCostSource } from '@/lib/pricing/cost-basis'
import { savePortalRules } from './actions'
import type { RuleSample } from './load'

const PORTALS: PricingPortal[] = ['store', 'business', 'corporate']

const field = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm'

function amount(value: number | null) {
  if (value == null) return 'Price on quote'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function PortalRules({
  rules,
  samples,
  showCost,
  micrositeHiddenSeparately,
  canEdit,
}: {
  rules: Record<PricingPortal, PortalRule>
  samples: RuleSample[]
  showCost: boolean
  micrositeHiddenSeparately: boolean
  canEdit: boolean
}) {
  const [draft, setDraft] = useState(rules)

  const preview = useMemo(() => samples.map((sample) => ({
    sample,
    prices: PORTALS.map((portal) => ({
      portal,
      resolved: resolvePortalPrice({
        portal,
        rule: draft[portal],
        costPrice: showCost ? sample.cost : null,
      }),
    })),
  })), [draft, samples, showCost])

  function update(portal: PricingPortal, patch: Partial<PortalRule>) {
    setDraft((current) => ({ ...current, [portal]: { ...current[portal], ...patch } }))
  }

  return (
    <ActionForm action={savePortalRules} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {PORTALS.map((portal) => {
          const rule = draft[portal]
          return (
            <section key={portal} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{PORTAL_LABEL[portal]}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {portal === 'store'
                    ? 'Retail store price = cost + this margin, unless the product has its own Retail margin or fixed price.'
                    : 'Price = cost + the company margin when the company has one, else the product margin, else this margin.'}
                  {' '}A product without a cost is priced on quote.
                </p>
              </div>
              <label className="block text-xs text-gray-500">
                Margin %
                <input
                  name={`${portal}_margin`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={rule.marginPercent ?? ''}
                  disabled={!canEdit}
                  onChange={(event) => update(portal, { marginPercent: event.target.value === '' ? null : Number(event.target.value) })}
                  className={field}
                  placeholder="No portal margin"
                />
              </label>
              <label className="block text-xs text-gray-500">
                Rounding
                <select
                  name={`${portal}_rounding`}
                  value={rule.rounding}
                  disabled={!canEdit}
                  onChange={(event) => update(portal, { rounding: event.target.value as RoundingMode })}
                  className={field}
                >
                  <option value="none">None (paise)</option>
                  <option value="whole">Whole rupee</option>
                  <option value="end9">Ends in 9</option>
                  <option value="end99">Ends in 99</option>
                </select>
              </label>
              <label className="block text-xs text-gray-500">
                Cost source
                <select
                  name={`${portal}_cost_source`}
                  value={rule.costSource}
                  disabled={!canEdit}
                  onChange={(event) => update(portal, { costSource: event.target.value as ResolvedCostSource })}
                  className={field}
                >
                  {RESOLVED_COST_SOURCES.map((source) => <option key={source} value={source}>{COST_SOURCE_LABEL[source]}</option>)}
                </select>
                <span className="mt-1 block text-[11px] text-gray-400">For products set to Use portal default. A product&apos;s own choice wins.</span>
              </label>
              <label className="block text-xs text-gray-500">
                GST mode
                <select
                  name={`${portal}_gst`}
                  value={rule.gstMode}
                  disabled={!canEdit}
                  onChange={(event) => update(portal, { gstMode: event.target.value as GstMode })}
                  className={field}
                >
                  <option value="inclusive">Inclusive</option>
                  <option value="exclusive">Exclusive</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input type="hidden" name={`${portal}_show`} value="0" />
                <input
                  type="checkbox"
                  name={`${portal}_show`}
                  value="1"
                  checked={rule.showPrices}
                  disabled={!canEdit}
                  onChange={(event) => update(portal, { showPrices: event.target.checked })}
                />
                Show prices
              </label>
              <label className="block text-xs text-gray-500">
                Minimum margin %
                <input
                  name={`${portal}_floor`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={rule.minMarginPercent}
                  disabled={!canEdit}
                  onChange={(event) => update(portal, { minMarginPercent: Number(event.target.value) })}
                  className={field}
                />
              </label>
              <p className="text-[11px] text-gray-500">Prices on this portal are labelled {gstPriceNote(rule.gstMode)}.</p>
              {portal === 'corporate' && micrositeHiddenSeparately ? (
                <p className="text-[11px] text-amber-800">The microsite is currently shown separately. Saving uses one show/hide for the corporate portal and the microsite.</p>
              ) : null}
            </section>
          )
        })}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Preview before saving</h2>
        <p className="mt-1 text-xs text-gray-500">Rule prices for a few products. Specials, catalog lines, and fixed prices are not in this preview.</p>
        {!showCost ? <p className="mt-1 text-xs text-gray-500">Cost stays hidden on this account, so the preview shows price on quote. The price grid shows the saved sell price.</p> : null}
        {preview.length === 0 ? <p className="mt-3 text-sm text-gray-500">No active products to preview.</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Product</th>
                  {PORTALS.map((portal) => <th key={portal} className="py-2 pr-3 font-medium">{PORTAL_LABEL[portal]}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map(({ sample, prices }) => (
                  <tr key={sample.id} className="border-t border-gray-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900">{sample.name}</p>
                      <p className="font-mono text-[10px] text-gray-400">{sample.sku}</p>
                    </td>
                    {prices.map(({ portal, resolved }) => (
                      <td key={portal} className="py-2 pr-3">
                        <p className="font-medium text-gray-900">{amount(resolved.price)}</p>
                        {showCost && resolved.belowFloor ? <p className="text-[10px] text-amber-800">Below floor</p> : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {canEdit ? (
        <SubmitButton className="rounded-lg bg-[#806A50] px-4 py-2 text-sm font-medium text-white" pendingLabel="Saving…">
          Save portal rules
        </SubmitButton>
      ) : null}
    </ActionForm>
  )
}
