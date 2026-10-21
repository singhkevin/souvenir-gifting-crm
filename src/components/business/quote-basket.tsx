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

  if (!ready) return <p className="text-sm text-[#4A4640]">Loading your quote basket…</p>
  if (!items.length) {
    return (
      <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-8 text-center sm:p-12">
        <p className="text-sm text-[#4A4640]">Your quote basket is empty. Add products from the catalogue.</p>
        <div className="mt-4">
          <a
            href="/business/catalogue"
            className="inline-block bg-[#000000] px-4 py-2 sv2-label text-xs text-white hover:bg-[#9E4300] transition-colors"
          >
            Browse catalogue
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] items-start">
      <div className="space-y-4">
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="border border-[#CCC5BD] bg-[#FCF9F2] p-4 sm:p-5 rounded-none">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg font-normal text-[#1C1C18]">{item.name}</p>
                  <p className="sv2-mono-sm text-xs text-[#7C766F] mt-0.5">SKU: {item.sku}</p>
                  <p className="mt-1 sv2-mono-sm text-sm font-semibold text-[#9E4300]">
                    {item.price == null ? 'Price on quote' : `${formatCurrency(item.price)} indicative · ${priceNote}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="border border-[#CCC5BD] bg-transparent px-2.5 py-1 sv2-label text-[10px] text-[#BA1A1A] hover:bg-[#FFDAD6]/30 transition-colors"
                  onClick={() => saveItems(items.filter((row) => row.id !== item.id))}
                >
                  Remove
                </button>
              </div>
              <label className="mt-3 block">
                <span className="sv2-label text-[10px] text-[#4A4640]">
                  Quantity (minimum <span className="sv2-mono-sm">{item.moq || 1}</span>)
                </span>
                <input
                  type="number"
                  min={item.moq || 1}
                  value={item.quantity}
                  onChange={(event) => {
                    const quantity = Math.round(Number(event.target.value))
                    saveItems(items.map((row) => (row.id === item.id ? { ...row, quantity } : row)))
                  }}
                  className="mt-1 w-32 border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-1.5 sv2-mono-sm text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
                />
              </label>
              {businessQuantityError(item.quantity, item.moq) ? (
                <div className="mt-2 border border-[#BA1A1A] bg-[#FFDAD6]/30 p-2 text-xs text-[#BA1A1A]">
                  {businessQuantityError(item.quantity, item.moq)}
                </div>
              ) : null}
              {(item.altQuantities || []).length ? (
                <p className="mt-2 text-xs text-[#4A4640]">
                  <span className="sv2-label text-[10px] text-[#7C766F]">Quantity breaks:</span>{' '}
                  <span className="sv2-mono-sm">{(item.altQuantities || []).join(', ')}</span>
                </p>
              ) : null}
              {item.note ? (
                <p className="mt-2 text-xs text-[#4A4640]">
                  <span className="sv2-label text-[10px] text-[#7C766F]">Note:</span> {item.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button
            type="button"
            className="border border-[#CCC5BD] bg-[#FCF9F2] px-3 py-1.5 sv2-label text-[10px] text-[#4A4640] hover:border-[#BA1A1A] hover:text-[#BA1A1A] transition-colors"
            onClick={() => saveItems([])}
          >
            Clear basket
          </button>
        </div>
      </div>
      <ActionForm
        action={submitBusinessRfq}
        className="space-y-4 border border-[#CCC5BD] bg-[#FCF9F2] p-5 sm:p-6 rounded-none"
      >
        <div className="border-b border-[#CCC5BD] pb-3">
          <h2 className="font-serif text-xl text-[#1C1C18]">Request Details</h2>
          <p className="mt-1 text-xs text-[#7C766F]">Submit this request for a formal quotation.</p>
        </div>
        <input type="hidden" name="client_request_id" value={meta.client_request_id} />
        <input type="hidden" name="lines_json" value={JSON.stringify(lines)} />
        <input type="hidden" name="fax" tabIndex={-1} autoComplete="off" className="hidden" />
        <label className="block">
          <span className="sv2-label text-[10px] text-[#4A4640]">Deadline</span>
          <input
            type="date"
            name="deadline"
            value={meta.deadline}
            onChange={(event) => saveMeta({ ...meta, deadline: event.target.value })}
            className="mt-1 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 sv2-mono-sm text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="sv2-label text-[10px] text-[#4A4640]">Delivery city</span>
          <input
            name="delivery_city"
            value={meta.delivery_city}
            onChange={(event) => saveMeta({ ...meta, delivery_city: event.target.value })}
            className="mt-1 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="sv2-label text-[10px] text-[#4A4640]">Budget (INR)</span>
          <input
            name="budget"
            type="number"
            min="0"
            value={meta.budget}
            onChange={(event) => saveMeta({ ...meta, budget: event.target.value })}
            className="mt-1 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 sv2-mono-sm text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="sv2-label text-[10px] text-[#4A4640]">Purpose</span>
          <input
            name="purpose"
            value={meta.purpose}
            onChange={(event) => saveMeta({ ...meta, purpose: event.target.value })}
            className="mt-1 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="sv2-label text-[10px] text-[#4A4640]">Notes</span>
          <textarea
            name="notes"
            value={meta.notes}
            onChange={(event) => saveMeta({ ...meta, notes: event.target.value })}
            rows={3}
            className="mt-1 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
          />
        </label>
        {pendingApproval ? (
          <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-3 text-xs text-[#9E4300] flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF8843] animate-pulse" />
            <span>Pending approval. Quote requests open after sales approves this account.</span>
          </div>
        ) : null}
        <TurnstileWidget />
        <SubmitButton
          disabled={blocked || pendingApproval}
          pendingLabel="Submitting…"
          className="w-full bg-[#9E4300] px-4 py-3 sv2-label text-xs text-white hover:bg-[#783100] transition-colors rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Request quote
        </SubmitButton>
      </ActionForm>
    </div>
  )
}
