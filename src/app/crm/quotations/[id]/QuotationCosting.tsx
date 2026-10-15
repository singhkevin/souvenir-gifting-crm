'use client'

import { useMemo, useState } from 'react'
import { applyQuotationItemPrice } from '../actions'
import { formatCurrency } from '@/lib/utils'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { liveMarginPercent, marginWarningText, marginWarnings, syncCostingFields } from '@/lib/quotes/flow'
import type { SupplierOffer } from '@/lib/pricing/offers'

type Line = {
  id: string
  name: string
  sku: string | null
  quantity: number
  unitPrice: number
  catalogCost?: number | null
  productId: string | null
}

type SavedCost = {
  quotation_item_id: string
  supplier_offer_id: string | null
  supplier_cost: number | null
  margin_percent: number | null
}

type Draft = { offerId: string; cost: string; margin: string; unit: string }

function parseAmount(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function money(value: number | null) {
  return value == null ? '' : String(value)
}

export function QuotationCosting({
  quotationId,
  editable,
  lines,
  offers,
  saved,
  bestByItem,
  defaultMargin,
}: {
  quotationId: string
  editable: boolean
  lines: Line[]
  offers: SupplierOffer[]
  saved: SavedCost[]
  bestByItem: Record<string, string | null>
  defaultMargin: number
}) {
  const { pending, run } = useAction()
  const savedByItem = useMemo(() => new Map(saved.map((row) => [row.quotation_item_id, row])), [saved])
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const initial: Record<string, Draft> = {}
    for (const line of lines) {
      const row = savedByItem.get(line.id)
      const offerId = row?.supplier_offer_id || bestByItem[line.id] || ''
      const offer = offers.find((item) => item.id === offerId)
      const cost = row?.supplier_cost ?? offer?.cost ?? line.catalogCost
      const hasCost = cost != null && Number.isFinite(Number(cost))
      const margin = hasCost ? (row?.margin_percent ?? defaultMargin) : null
      const synced = syncCostingFields({
        cost: hasCost ? Number(cost) : null,
        margin,
        sell: line.unitPrice,
        edited: 'sell',
      })
      initial[line.id] = {
        offerId,
        cost: money(synced.cost),
        margin: money(synced.margin),
        unit: money(synced.sell ?? line.unitPrice),
      }
    }
    return initial
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Supplier cost and sell price</h2>
        <p className="mt-1 text-xs text-gray-500">
          Change cost, margin, or sell price. The other two update together and save on the line.
          The client sees only the sell price.
        </p>
      </div>
      {lines.map((line) => (
        <CostLine
          key={line.id}
          quotationId={quotationId}
          line={line}
          offers={offers.filter((offer) => offer.product_id === line.productId)}
          bestId={bestByItem[line.id] || null}
          defaultMargin={defaultMargin}
          editable={editable}
          busy={pending}
          draft={drafts[line.id]}
          onDraft={(draft) => setDrafts((current) => ({ ...current, [line.id]: draft }))}
          run={run}
        />
      ))}
    </div>
  )
}

function CostLine({
  quotationId,
  line,
  offers,
  bestId,
  defaultMargin,
  editable,
  busy,
  draft,
  onDraft,
  run,
}: {
  quotationId: string
  line: Line
  offers: SupplierOffer[]
  bestId: string | null
  defaultMargin: number
  editable: boolean
  busy: boolean
  draft: Draft
  onDraft: (draft: Draft) => void
  run: ReturnType<typeof useAction>['run']
}) {
  const [saving, setSaving] = useState(false)
  const costValue = parseAmount(draft.cost)
  const sellValue = parseAmount(draft.unit) ?? 0
  const warnings = marginWarnings(costValue, sellValue)
  const marginLive = liveMarginPercent(costValue, sellValue)

  function edit(field: 'cost' | 'margin' | 'sell', raw: string, offerId = draft.offerId) {
    const next = { ...draft, offerId }
    if (field === 'cost') next.cost = raw
    if (field === 'margin') next.margin = raw
    if (field === 'sell') next.unit = raw
    const synced = syncCostingFields({
      cost: parseAmount(next.cost),
      margin: parseAmount(next.margin),
      sell: parseAmount(next.unit),
      edited: field,
    })
    onDraft({
      offerId,
      cost: field === 'cost' ? raw : money(synced.cost),
      margin: field === 'margin' ? raw : money(synced.margin),
      unit: field === 'sell' ? raw : money(synced.sell),
    })
  }

  function save(next = draft) {
    if (!editable) return
    const formData = new FormData()
    formData.set('quotation_id', quotationId)
    formData.set('item_id', line.id)
    formData.set('supplier_offer_id', next.offerId)
    formData.set('supplier_cost', next.cost)
    formData.set('margin_percent', next.margin)
    formData.set('unit_price', next.unit || '0')
    setSaving(true)
    run(() => applyQuotationItemPrice(formData), {
      successMessage: false,
      onSuccess: () => setSaving(false),
      onError: () => setSaving(false),
    })
  }

  return (
    <div className={`rounded-lg border p-3 text-xs space-y-3 ${warnings.some((code) => code === 'above_sell') ? 'border-red-300 bg-red-50/40' : warnings.length ? 'border-amber-300 bg-amber-50/40' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{line.name}</p>
          <p className="font-mono text-[10px] text-gray-400">{line.sku} · qty {line.quantity}</p>
        </div>
        <div className="text-right text-gray-700">
          {saving || busy ? <span className="inline-flex items-center gap-1"><Spinner />Saving</span> : <span>Saved with the line</span>}
          <p>Margin {marginLive == null ? '—' : `${marginLive}%`}</p>
        </div>
      </div>
      {warnings.length > 0 && (
        <ul className={warnings.includes('above_sell') ? 'text-red-800' : 'text-amber-800'}>
          {warnings.map((code) => <li key={code}>{marginWarningText(code)}</li>)}
        </ul>
      )}
      {offers.length === 0 ? (
        <p className="text-gray-500">No supplier offers on this product. Enter a negotiated cost.</p>
      ) : (
        <label className="block">
          Supplier offer
          <select
            value={draft.offerId}
            disabled={!editable}
            onChange={(event) => {
              const offer = offers.find((item) => item.id === event.target.value)
              const margin = draft.margin.trim() === '' ? String(defaultMargin) : draft.margin
              const next = { ...draft, offerId: event.target.value, cost: offer ? String(offer.cost) : draft.cost, margin }
              const synced = syncCostingFields({
                cost: parseAmount(next.cost),
                margin: parseAmount(next.margin),
                sell: parseAmount(next.unit),
                edited: 'cost',
              })
              const savedDraft = { offerId: next.offerId, cost: money(synced.cost), margin: money(synced.margin), unit: money(synced.sell) }
              onDraft(savedDraft)
              save(savedDraft)
            }}
            className="mt-1 w-full rounded border px-2 py-1.5"
          >
            <option value="">Negotiated cost</option>
            {offers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.supplier_name || 'Supplier'}
                {offer.supplier_sku ? ` · ${offer.supplier_sku}` : ''}
                {` · ${formatCurrency(offer.cost)} · MOQ ${offer.moq}`}
                {offer.id === bestId ? ' · best' : ''}
                {offer.is_preferred ? ' · pinned' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label>
          Cost
          <input type="number" min="0" step="0.01" value={draft.cost} disabled={!editable} onChange={(event) => edit('cost', event.target.value)} onBlur={() => save()} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label>
          Margin %
          <input type="number" step="0.01" value={draft.margin} disabled={!editable || costValue == null || costValue <= 0} onChange={(event) => edit('margin', event.target.value)} onBlur={() => save()} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label>
          Sell price
          <input type="number" min="0" step="0.01" value={draft.unit} disabled={!editable} onChange={(event) => edit('sell', event.target.value)} onBlur={() => save()} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
      </div>
    </div>
  )
}
