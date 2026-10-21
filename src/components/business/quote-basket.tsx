'use client'

import { useEffect, useState } from 'react'
import { submitBusinessRfq } from '@/app/business/actions'
import { TurnstileWidget } from '@/components/site/turnstile-widget'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { readCart, writeCart, type CartItem } from '@/lib/catalogue/cart'
import {
  BUSINESS_QUOTE_KEY,
  BUSINESS_QUOTE_META_KEY,
  businessQuantityError,
  normaliseBreaks,
} from '@/lib/business/lines'
import { formatCurrency } from '@/lib/utils'

type Meta = {
  client_request_id: string
  deadline: string
  delivery_city: string
  budget: string
  purpose: string
  notes: string
}

const EMPTY_META: Meta = {
  client_request_id: '',
  deadline: '',
  delivery_city: '',
  budget: '',
  purpose: '',
  notes: '',
}

function loadMeta(): Meta {
  try {
    const parsed = JSON.parse(localStorage.getItem(BUSINESS_QUOTE_META_KEY) || '{}') as Partial<Meta>
    return {
      ...EMPTY_META,
      ...parsed,
      client_request_id: parsed.client_request_id || crypto.randomUUID(),
    }
  } catch {
    return { ...EMPTY_META, client_request_id: crypto.randomUUID() }
  }
}

export function QuoteBasket({ pendingApproval = false, priceNote = 'excl. GST' }: { pendingApproval?: boolean; priceNote?: string }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [meta, setMeta] = useState<Meta>(EMPTY_META)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setItems(readCart(BUSINESS_QUOTE_KEY))
      const next = loadMeta()
      setMeta(next)
      localStorage.setItem(BUSINESS_QUOTE_META_KEY, JSON.stringify(next))
      setReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  const saveMeta = (next: Meta) => {
    setMeta(next)
    localStorage.setItem(BUSINESS_QUOTE_META_KEY, JSON.stringify(next))
  }

  const saveItems = (next: CartItem[]) => {
    setItems(next)
    writeCart(next, BUSINESS_QUOTE_KEY)
  }

  const lines = items.map((item) => ({
    productId: item.id,
    quantity: item.quantity,
    moq: item.moq || 1,
    altQuantities: normaliseBreaks(item.moq, item.quantity, item.altQuantities || []),
    targetUnitPrice: item.targetUnitPrice ?? null,
    note: item.note || '',
  }))
  const blocked = lines.some((line) => businessQuantityError(line.quantity, line.moq))

  if (!ready) return <p className="text-sm text-[#5C6570]">Loading your quote basket…</p>
  if (!items.length) {
    return <p className="text-sm text-[#5C6570]">Your quote basket is empty. Add products from the catalogue.</p>
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-[#E8E4DE] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-[#5C6570]">{item.sku}</p>
                <p className="mt-1 text-sm text-[#806A50]">
                  {item.price == null ? 'Price on quote' : `${formatCurrency(item.price)} indicative · ${priceNote}`}
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-red-700"
                onClick={() => saveItems(items.filter((row) => row.id !== item.id))}
              >
                Remove
              </button>
            </div>
            <label className="mt-3 block text-xs text-[#5C6570]">
              Quantity (minimum {item.moq || 1})
              <input
                type="number"
                min={item.moq || 1}
                value={item.quantity}
                onChange={(event) => {
                  const quantity = Math.round(Number(event.target.value))
                  saveItems(items.map((row) => (row.id === item.id ? { ...row, quantity } : row)))
                }}
                className="mt-1 w-28 rounded-md border border-[#E5DFD5] px-2 py-1 text-sm text-[#1B2430]"
              />
            </label>
            {businessQuantityError(item.quantity, item.moq) ? (
              <p className="mt-1 text-xs text-red-700">{businessQuantityError(item.quantity, item.moq)}</p>
            ) : null}
            {(item.altQuantities || []).length ? (
              <p className="mt-2 text-xs text-[#5C6570]">Breaks: {(item.altQuantities || []).join(', ')}</p>
            ) : null}
            {item.note ? <p className="mt-2 text-xs text-[#5C6570]">{item.note}</p> : null}
          </li>
        ))}
        <button type="button" className="text-xs text-[#5C6570]" onClick={() => saveItems([])}>
          Clear basket
        </button>
      </ul>
      <ActionForm action={submitBusinessRfq} className="space-y-3 rounded-lg border border-[#E8E4DE] bg-white p-4">
        <input type="hidden" name="client_request_id" value={meta.client_request_id} />
        <input type="hidden" name="lines_json" value={JSON.stringify(lines)} />
        <input type="hidden" name="fax" tabIndex={-1} autoComplete="off" className="hidden" />
        <label className="block text-sm">
          Deadline
          <input
            type="date"
            name="deadline"
            value={meta.deadline}
            onChange={(event) => saveMeta({ ...meta, deadline: event.target.value })}
            className="mt-1 w-full rounded-md border border-[#E5DFD5] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Delivery city
          <input
            name="delivery_city"
            value={meta.delivery_city}
            onChange={(event) => saveMeta({ ...meta, delivery_city: event.target.value })}
            className="mt-1 w-full rounded-md border border-[#E5DFD5] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Budget
          <input
            name="budget"
            type="number"
            min="0"
            value={meta.budget}
            onChange={(event) => saveMeta({ ...meta, budget: event.target.value })}
            className="mt-1 w-full rounded-md border border-[#E5DFD5] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Purpose
          <input
            name="purpose"
            value={meta.purpose}
            onChange={(event) => saveMeta({ ...meta, purpose: event.target.value })}
            className="mt-1 w-full rounded-md border border-[#E5DFD5] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Notes
          <textarea
            name="notes"
            value={meta.notes}
            onChange={(event) => saveMeta({ ...meta, notes: event.target.value })}
            rows={3}
            className="mt-1 w-full rounded-md border border-[#E5DFD5] px-3 py-2"
          />
        </label>
        {pendingApproval ? (
          <p className="text-sm text-amber-950">Pending approval. Quote requests open after sales approves this account.</p>
        ) : null}
        <TurnstileWidget />
        <SubmitButton
          disabled={blocked || pendingApproval}
          pendingLabel="Submitting…"
          className="w-full bg-[#806A50] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-60"
        >
          Request quote
        </SubmitButton>
      </ActionForm>
    </div>
  )
}
