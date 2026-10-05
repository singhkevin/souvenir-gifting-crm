'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { applyQuotationItemPrice } from '../actions'
import { formatCurrency } from '@/lib/utils'
import { roundMoney } from '@/lib/pricing/resolve'
import type { SupplierOffer } from '@/lib/pricing/offers'

type Line = {
  id: string
  name: string
  sku: string | null
  quantity: number
  unitPrice: number
}

type SavedCost = {
  quotation_item_id: string
  supplier_offer_id: string | null
  supplier_cost: number | null
  margin_percent: number | null
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
  lines: (Line & { productId: string | null })[]
  offers: SupplierOffer[]
  saved: SavedCost[]
  bestByItem: Record<string, string | null>
  defaultMargin: number
}) {
  const router = useRouter()
  const savedByItem = useMemo(() => new Map(saved.map((row) => [row.quotation_item_id, row])), [saved])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Supplier cost and sell price</h2>
        <p className="mt-1 text-xs text-gray-500">
          Pick a supplier offer or type a negotiated cost. The client quotation shows only the sell price.
          {editable ? ' Apply a price before sending.' : ' This quotation is no longer a draft.'}
        </p>
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
          onSaved={() => {
            toast.success('Sell price updated')
            router.refresh()
          }}
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
  onSaved,
}: {
  quotationId: string
  line: Line & { productId: string | null }
  offers: SupplierOffer[]
  saved: SavedCost | null
  bestId: string | null
  defaultMargin: number
  editable: boolean
  onSaved: () => void
}) {
  const initialOffer = saved?.supplier_offer_id || bestId || ''
  const initial = offers.find((offer) => offer.id === initialOffer)
  const [offerId, setOfferId] = useState(initialOffer)
  const [cost, setCost] = useState(String(saved?.supplier_cost ?? initial?.cost ?? ''))
  const [margin, setMargin] = useState(String(saved?.margin_percent ?? defaultMargin))
  const [unit, setUnit] = useState(String(line.unitPrice || ''))
  const [saving, setSaving] = useState(false)

  const suggested = (() => {
    const costValue = Number(cost)
    const marginValue = Number(margin)
    if (!Number.isFinite(costValue) || !Number.isFinite(marginValue)) return null
    return roundMoney(costValue * (1 + marginValue / 100))
  })()

  return (
    <div className="rounded-lg border border-gray-100 p-3 text-xs space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">{line.name}</p>
          <p className="font-mono text-[10px] text-gray-400">{line.sku} · qty {line.quantity}</p>
        </div>
        <p className="text-gray-600">Current sell {formatCurrency(line.unitPrice)}</p>
      </div>
      {offers.length === 0 ? (
        <p className="text-gray-500">No supplier offers on this product. Enter a negotiated cost.</p>
      ) : (
        <div className="space-y-1">
          {offers.map((offer) => (
            <label key={offer.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`offer-${line.id}`}
                checked={offerId === offer.id}
                disabled={!editable}
                onChange={() => {
                  setOfferId(offer.id)
                  setCost(String(offer.cost))
                }}
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
          <input type="number" min="0" step="0.01" value={cost} disabled={!editable} onChange={(event) => setCost(event.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label>
          Margin %
          <input type="number" min="0" step="0.01" value={margin} disabled={!editable} onChange={(event) => setMargin(event.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
        <label>
          Client sell price
          <input type="number" min="0" step="0.01" value={unit} disabled={!editable} onChange={(event) => setUnit(event.target.value)} className="mt-1 w-full rounded border px-2 py-1.5" />
        </label>
      </div>
      {suggested != null && (
        <button type="button" className="text-[#806A50]" disabled={!editable} onClick={() => setUnit(String(suggested))}>
          Use {formatCurrency(suggested)} from cost and margin
        </button>
      )}
      {editable && (
        <button
          type="button"
          disabled={saving}
          className="rounded-lg bg-[#624B32] px-3 py-1.5 font-semibold text-white disabled:opacity-50"
          onClick={async () => {
            const formData = new FormData()
            formData.set('quotation_id', quotationId)
            formData.set('item_id', line.id)
            formData.set('supplier_offer_id', offerId)
            formData.set('supplier_cost', cost)
            formData.set('margin_percent', margin)
            formData.set('unit_price', unit)
            setSaving(true)
            const result = await applyQuotationItemPrice(formData)
            setSaving(false)
            if (result && 'error' in result && result.error) {
              toast.error(result.error)
              return
            }
            onSaved()
          }}
        >
          {saving ? 'Saving...' : 'Apply sell price'}
        </button>
      )}
    </div>
  )
}
