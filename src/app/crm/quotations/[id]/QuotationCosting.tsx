'use client'

import { useMemo, useState } from 'react'
import { applyAllQuotationPrices, applyQuotationItemPrice } from '../actions'
import { formatCurrency } from '@/lib/utils'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { liveMarginPercent, marginWarningText, marginWarnings, suggestedSell } from '@/lib/quotes/flow'
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
      initial[line.id] = {
        offerId,
        cost: hasCost ? String(cost) : '',
        margin: hasCost ? String(row?.margin_percent ?? defaultMargin) : '',
        unit: String(line.unitPrice || ''),
      }
    }
    return initial
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Supplier cost and sell price</h2>
          <p className="mt-1 text-xs text-gray-500">
            Pick a supplier offer or type a negotiated cost. The client quotation shows only the sell price.
            {editable ? ' Apply a price before sending.' : ' This quotation is no longer a draft.'}
          </p>
        </div>
        {editable && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => applyAllQuotationPrices(quotationId, lines.map((line) => {
              const draft = drafts[line.id]
              const costBlank = !draft || draft.cost.trim() === ''
              return {
                itemId: line.id,
                offerId: draft?.offerId || '',
                cost: costBlank ? Number.NaN : Number(draft.cost),
                margin: !draft || draft.margin.trim() === '' ? defaultMargin : Number(draft.margin),
                unitPrice: Number(draft.unit),
              }
            })), { successMessage: 'Sell prices updated' })}
            className="rounded-lg border border-[#624B32] px-3 py-1.5 text-xs font-semibold text-[#624B32] disabled:opacity-50"
          >
            {pending ? <span className="inline-flex items-center gap-2"><Spinner />Applying…</span> : 'Apply all'}
          </button>
        )}
      </div>
      {lines.map((line) => (
        <CostLine
          key={line.id}
          quotationId={quotationId}
          line={line}
          offers={offers.filter((offer) => offer.product_id === line.productId)}
          saved={savedByItem.get(line.id) || null}
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
  saved,
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
  saved: SavedCost | null
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
  const marginValue = parseAmount(draft.margin)
  const warnings = marginWarnings(costValue, sellValue)
  const marginLive = liveMarginPercent(costValue, sellValue)
  const suggested = suggestedSell(costValue, marginValue)
  const applied = Boolean(saved)

  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch }
    if (patch.cost != null && patch.cost.trim() !== '' && draft.margin.trim() === '' && patch.margin == null) {
      next.margin = String(defaultMargin)
    }
    onDraft(next)
  }

  return (
    <div className={`rounded-lg border p-3 text-xs space-y-3 ${warnings.length ? 'border-amber-300 bg-amber-50/40' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{line.name}</p>
          <p className="font-mono text-[10px] text-gray-400">{line.sku} · qty {line.quantity}</p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${applied ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
            {applied ? 'Saved' : 'Not applied'}
          </span>
          <p className="mt-1 text-gray-600">Current sell {formatCurrency(line.unitPrice)}</p>
          <p className="text-gray-700">Margin {marginLive == null ? '—' : `${marginLive}%`}</p>
        </div>
      </div>
      {warnings.length > 0 && (
        <ul className="text-amber-800">
          {warnings.map((code) => <li key={code}>{marginWarningText(code)}</li>)}
        </ul>
      )}
      {offers.length === 0 ? (
        <p className="text-gray-500">No supplier offers on this product. Enter a negotiated cost.</p>
      ) : (
        <div className="space-y-1">
          {offers.map((offer) => (
            <label key={offer.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`offer-${line.id}`}
                checked={draft.offerId === offer.id}
                disabled={!editable}
                onChange={() => update({ offerId: offer.id, cost: String(offer.cost), margin: draft.margin.trim() === '' ? String(defaultMargin) : draft.margin })}
              />
              <span>
                {offer.supplier_name || 'Supplier'}
                {offer.supplier_sku ? ` · ${offer.supplier_sku}` : ''}
                {' · '}{formatCurrency(offer.cost)}
                {' · MOQ '}{offer.moq}
                {offer.lead_time_days != null ? ` · ${offer.lead_time_days}d` : ''}
                {offer.in_stock ? '' : ' · out of stock'}
                {offer.id === bestId ? ' · best' : ''}
                {offer.is_preferred ? ' · pinned' : ''}
                {offer.is_active ? '' : ' · inactive'}
              </span>
            </label>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label>
          Negotiated cost
          <input type="number" min="0" step="0.01" value={draft.cost} disabled={!editable} onChange={(event) => update({ cost: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label>
          Margin %
          <input type="number" min="0" step="0.01" value={draft.margin} disabled={!editable || costValue == null} onChange={(event) => update({ margin: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label>
          Client sell price
          <input type="number" min="0" step="0.01" value={draft.unit} disabled={!editable} onChange={(event) => update({ unit: event.target.value })} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
      </div>
      {suggested != null && (
        <button type="button" className="text-[#806A50]" disabled={!editable} onClick={() => update({ unit: String(suggested) })}>
          Use {formatCurrency(suggested)} from cost and margin
        </button>
      )}
      {editable && (
        <button
          type="button"
          disabled={busy}
          aria-busy={saving || undefined}
          className="rounded-lg bg-[#624B32] px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          onClick={() => {
            const formData = new FormData()
            formData.set('quotation_id', quotationId)
            formData.set('item_id', line.id)
            formData.set('supplier_offer_id', draft.offerId)
            formData.set('supplier_cost', draft.cost)
            formData.set('margin_percent', draft.margin.trim() === '' && draft.cost.trim() !== '' ? String(defaultMargin) : draft.margin)
            formData.set('unit_price', draft.unit)
            setSaving(true)
            run(() => applyQuotationItemPrice(formData), {
              successMessage: 'Sell price updated',
              onSuccess: () => setSaving(false),
              onError: () => setSaving(false),
            })
          }}
        >
          {saving ? <span className="inline-flex items-center gap-2"><Spinner />Saving…</span> : 'Apply sell price'}
        </button>
      )}
    </div>
  )
}
