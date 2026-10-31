'use client'

import { useEffect, useMemo, useState } from 'react'
import { saveQuotationLinePrices } from '../actions'
import { formatCurrency } from '@/lib/utils'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { liveMarginPercent, marginWarningText, marginWarnings, syncCostingFields } from '@/lib/quotes/flow'
import { costingFieldsDirty, costingStatusLabel, type CostingDraftFields } from '@/lib/quotes/costing-draft'
import type { SupplierOffer } from '@/lib/pricing/offers'
import { ProductThumb } from '@/components/ui/product-thumb'
import { useQuotationLive } from './quotation-live'

type Line = {
  id: string
  name: string
  sku: string | null
  imageUrl?: string | null
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

type Draft = CostingDraftFields

function parseAmount(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function money(value: number | null) {
  return value == null ? '' : String(value)
}

function initialDraft(
  line: Line,
  savedByItem: Map<string, SavedCost>,
  offers: SupplierOffer[],
  bestByItem: Record<string, string | null>,
  defaultMargin: number,
): Draft {
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
  return {
    offerId,
    cost: money(synced.cost),
    margin: money(synced.margin),
    unit: money(synced.sell ?? line.unitPrice),
  }
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
  const { commitPrice, registerSaver } = useQuotationLive()
  const savedByItem = useMemo(() => new Map(saved.map((row) => [row.quotation_item_id, row])), [saved])
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const initial: Record<string, Draft> = {}
    for (const line of lines) initial[line.id] = initialDraft(line, savedByItem, offers, bestByItem, defaultMargin)
    return initial
  })
  const [baselines, setBaselines] = useState<Record<string, Draft>>(() => {
    const initial: Record<string, Draft> = {}
    for (const line of lines) initial[line.id] = initialDraft(line, savedByItem, offers, bestByItem, defaultMargin)
    return initial
  })
  const [savingIds, setSavingIds] = useState<string[]>([])
  const lineKey = lines.map((line) => line.id).join('|')
  const [seenLines, setSeenLines] = useState(lineKey)
  if (seenLines !== lineKey) {
    setSeenLines(lineKey)
    const missing = lines.filter((line) => !drafts[line.id])
    if (missing.length) {
      setDrafts((current) => {
        const next = { ...current }
        for (const line of missing) {
          if (!next[line.id]) next[line.id] = initialDraft(line, savedByItem, offers, bestByItem, defaultMargin)
        }
        return next
      })
      setBaselines((current) => {
        const next = { ...current }
        for (const line of missing) {
          if (!next[line.id]) next[line.id] = initialDraft(line, savedByItem, offers, bestByItem, defaultMargin)
        }
        return next
      })
    }
  }

  const dirtyIds = lines
    .map((line) => line.id)
    .filter((id) => drafts[id] && baselines[id] && costingFieldsDirty(drafts[id], baselines[id]))
  const saving = savingIds.length > 0 || pending
  const dirty = dirtyIds.length > 0

  function priceInput(draft: Draft) {
    return {
      itemId: '',
      offerId: draft.offerId,
      cost: parseAmount(draft.cost),
      margin: parseAmount(draft.margin),
      unitPrice: parseAmount(draft.unit) ?? Number.NaN,
    }
  }

  function persist(rows: { id: string; draft: Draft }[], announce: boolean) {
    const payload = rows.flatMap((row) => {
      const baseline = baselines[row.id]
      if (!baseline || !costingFieldsDirty(row.draft, baseline)) return []
      return [{ ...row, input: { ...priceInput(row.draft), itemId: row.id } }]
    })
    if (!payload.length || !editable) return
    const started = run(() => saveQuotationLinePrices(quotationId, payload.map((row) => row.input)), {
      successMessage: announce ? (payload.length > 1 ? 'Prices saved' : 'Sell price saved') : false,
      onSuccess: () => {
        setSavingIds((current) => current.filter((id) => !payload.some((row) => row.id === id)))
        setBaselines((current) => {
          const next = { ...current }
          for (const row of payload) next[row.id] = row.draft
          return next
        })
        for (const row of payload) {
          const unit = parseAmount(row.draft.unit)
          if (unit != null) commitPrice(row.id, unit)
        }
      },
      onError: () => setSavingIds((current) => current.filter((id) => !payload.some((row) => row.id === id))),
    })
    if (started === false) return
    setSavingIds(payload.map((row) => row.id))
  }

  useEffect(() => {
    if (!editable) return
    const rows = lines.flatMap((line) => {
      const draft = drafts[line.id]
      const baseline = baselines[line.id]
      if (!draft || !baseline || !costingFieldsDirty(draft, baseline)) return []
      return [{ id: line.id, draft }]
    })
    registerSaver('prices', {
      dirty,
      saving,
      save: () => persist(rows, true),
    })
  }, [dirty, saving, editable, registerSaver, drafts, baselines, lines]) // eslint-disable-line react-hooks/exhaustive-deps -- persist closes over the drafts and baselines listed here

  return (
    <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden space-y-0">
      <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD] flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">
            Supplier Cost &amp; Sell Price
          </h2>
          <p className="mt-1 text-xs text-[#4A4640]">
            Change cost, margin, or sell price. The other two update together. Save the line, or leave the field and it saves.
            The client sees only the sell price.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${dirty || saving ? 'text-[#9E4300]' : 'text-[#3A4537]'}`} aria-live="polite">
            {costingStatusLabel(saving, dirty)}
          </span>
          {editable && dirtyIds.length > 1 ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => persist(dirtyIds.flatMap((id) => (drafts[id] ? [{ id, draft: drafts[id] }] : [])), true)}
              disabled={pending}
              className="min-h-9 rounded-none bg-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] disabled:opacity-50"
            >
              Save all prices
            </button>
          ) : null}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {lines.map((line) => drafts[line.id] && baselines[line.id] ? (
          <CostLine
            key={line.id}
            line={line}
            offers={offers.filter((offer) => offer.product_id === line.productId)}
            bestId={bestByItem[line.id] || null}
            defaultMargin={defaultMargin}
            editable={editable}
            saving={savingIds.includes(line.id)}
            draft={drafts[line.id]}
            baseline={baselines[line.id]}
            onDraft={(draft) => setDrafts((current) => ({ ...current, [line.id]: draft }))}
            onSave={(draft, announce) => persist([{ id: line.id, draft }], announce)}
          />
        ) : null)}
      </div>
    </div>
  )
}

function CostLine({
  line,
  offers,
  bestId,
  defaultMargin,
  editable,
  saving,
  draft,
  baseline,
  onDraft,
  onSave,
}: {
  line: Line
  offers: SupplierOffer[]
  bestId: string | null
  defaultMargin: number
  editable: boolean
  saving: boolean
  draft: Draft
  baseline: Draft
  onDraft: (draft: Draft) => void
  onSave: (draft: Draft, announce: boolean) => void
}) {
  const costValue = parseAmount(draft.cost)
  const sellValue = parseAmount(draft.unit) ?? 0
  const warnings = marginWarnings(costValue, sellValue)
  const marginLive = liveMarginPercent(costValue, sellValue)
  const dirty = costingFieldsDirty(draft, baseline)
  const status = costingStatusLabel(saving, dirty)

  function edited(field: 'cost' | 'margin' | 'sell', raw: string, offerId = draft.offerId): Draft {
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
    return {
      offerId,
      cost: field === 'cost' ? raw : money(synced.cost),
      margin: field === 'margin' ? raw : money(synced.margin),
      unit: field === 'sell' ? raw : money(synced.sell),
    }
  }

  const cardBorderBg = warnings.some((code) => code === 'above_sell')
    ? 'border-[#BA1A1A]/40 bg-[#FBEDEB]'
    : warnings.length
    ? 'border-[#9E4300]/30 bg-[#FFB690]/20'
    : 'border-[#CCC5BD] bg-[#FCF9F2]'

  return (
    <div className={`rounded-none border p-4 text-xs space-y-3.5 ${cardBorderBg}`}>
      <div className="flex items-start justify-between gap-3">
        <ProductThumb src={line.imageUrl} alt={line.name} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-[#1C1C18]">{line.name}</p>
          <p className="font-mono text-xs text-[#7C766F] mt-0.5">{line.sku} · qty {line.quantity}</p>
        </div>
        <div className="text-right text-[#4A4640]">
          {saving ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#9E4300] font-mono">
              <Spinner />Saving…
            </span>
          ) : (
            <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${dirty ? 'text-[#9E4300]' : 'text-[#3A4537]'}`}>
              {status}
            </span>
          )}
          <p className="text-xs font-mono font-semibold text-[#1C1C18] mt-0.5">Margin {marginLive == null ? '—' : `${marginLive}%`}</p>
        </div>
      </div>
      {warnings.length > 0 && (
        <ul className={`text-xs space-y-0.5 p-2 rounded-none border ${warnings.includes('above_sell') ? 'border-[#BA1A1A]/40 bg-[#FBEDEB] text-[#BA1A1A]' : 'border-[#9E4300]/30 bg-[#FFB690]/20 text-[#9E4300]'}`}>
          {warnings.map((code) => <li key={code}>{marginWarningText(code)}</li>)}
        </ul>
      )}
      {offers.length === 0 ? (
        <p className="text-[#7C766F] italic">No supplier offers on this product. Enter a negotiated cost.</p>
      ) : (
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Supplier offer</span>
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
              onSave(savedDraft, false)
            }}
            className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PriceField label="Cost (₹)" value={draft.cost} disabled={!editable} onChange={(value) => onDraft(edited('cost', value))} onCommit={(raw, announce) => { const next = edited('cost', raw); onDraft(next); onSave(next, announce) }} />
        <PriceField
          label="Margin %"
          value={draft.margin}
          disabled={!editable || costValue == null || costValue <= 0}
          onChange={(value) => onDraft(edited('margin', value))}
          onCommit={(raw, announce) => { const next = edited('margin', raw); onDraft(next); onSave(next, announce) }}
        />
        <PriceField label="Sell price (₹)" value={draft.unit} disabled={!editable} onChange={(value) => onDraft(edited('sell', value))} onCommit={(raw, announce) => { const next = edited('sell', raw); onDraft(next); onSave(next, announce) }} />
      </div>
      {editable && dirty ? (
        <div className="flex justify-end">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSave(draft, true)}
            className="min-h-9 rounded-none bg-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300]"
          >
            Save
          </button>
        </div>
      ) : null}
    </div>
  )
}

function PriceField({
  label,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
  onCommit: (raw: string, announce: boolean) => void
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">{label}</span>
      <input
        type="number"
        min={label === 'Margin %' ? undefined : '0'}
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onCommit(event.currentTarget.value, false)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          onCommit(event.currentTarget.value, true)
        }}
        className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
      />
    </label>
  )
}
