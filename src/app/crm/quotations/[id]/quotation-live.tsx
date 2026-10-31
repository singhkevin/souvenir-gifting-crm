'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { estimateTickedLines, quoteLineTotal } from '@/lib/quotes/flow'
import { emptyLiveAhead, reconcileLiveQuote, type LiveQuoteAhead, type LiveQuoteLine } from '@/lib/quotes/live-quote'

type Snapshot = {
  lines: LiveQuoteLine[]
  discountPercent: number
  taxPercent: number
}

type Saver = {
  dirty: boolean
  saving: boolean
  save: () => void
}

type QuotationLiveContext = {
  snapshot: Snapshot
  totals: ReturnType<typeof estimateTickedLines>
  lineById: (id: string) => LiveQuoteLine | undefined
  commitPrice: (id: string, unitPrice: number) => void
  commitQuantity: (id: string, quantity: number) => void
  commitHeader: (patch: { discountPercent?: number; taxPercent?: number }) => void
  registerSaver: (id: string, saver: Saver) => void
  dirty: boolean
  saving: boolean
  saveAll: () => void
}

const Context = createContext<QuotationLiveContext | null>(null)

export function useQuotationLive() {
  const value = useContext(Context)
  if (!value) throw new Error('Quotation draft state is unavailable')
  return value
}

export function QuotationLiveProvider({
  lines,
  discountPercent,
  taxPercent,
  children,
}: {
  lines: LiveQuoteLine[]
  discountPercent: number
  taxPercent: number
  children: ReactNode
}) {
  const serverKey = JSON.stringify({ lines, discountPercent, taxPercent })
  const [snapshot, setSnapshot] = useState<Snapshot>({ lines, discountPercent, taxPercent })
  const ahead = useRef<LiveQuoteAhead>(emptyLiveAhead())
  const saveFns = useRef(new Map<string, () => void>())
  const [parts, setParts] = useState<Record<string, { dirty: boolean; saving: boolean }>>({})

  useEffect(() => {
    const server = JSON.parse(serverKey) as { lines: LiveQuoteLine[]; discountPercent: number; taxPercent: number }
    const next = reconcileLiveQuote(server, ahead.current)
    ahead.current = next.ahead
    setSnapshot({ lines: next.lines, discountPercent: next.discountPercent, taxPercent: next.taxPercent })
  }, [serverKey])

  const commitPrice = useCallback((id: string, unitPrice: number) => {
    ahead.current.prices[id] = unitPrice
    setSnapshot((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? { ...line, unitPrice } : line)),
    }))
  }, [])

  const commitQuantity = useCallback((id: string, quantity: number) => {
    ahead.current.quantities[id] = quantity
    setSnapshot((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? { ...line, quantity } : line)),
    }))
  }, [])

  const commitHeader = useCallback((patch: { discountPercent?: number; taxPercent?: number }) => {
    if (patch.discountPercent != null) ahead.current.discountPercent = patch.discountPercent
    if (patch.taxPercent != null) ahead.current.taxPercent = patch.taxPercent
    setSnapshot((current) => ({
      ...current,
      discountPercent: patch.discountPercent ?? current.discountPercent,
      taxPercent: patch.taxPercent ?? current.taxPercent,
    }))
  }, [])

  const registerSaver = useCallback((id: string, saver: Saver) => {
    saveFns.current.set(id, saver.save)
    setParts((current) => {
      const prev = current[id]
      if (prev && prev.dirty === saver.dirty && prev.saving === saver.saving) return current
      return { ...current, [id]: { dirty: saver.dirty, saving: saver.saving } }
    })
  }, [])

  const dirty = Object.values(parts).some((part) => part.dirty)
  const saving = Object.values(parts).some((part) => part.saving)
  const saveAll = useCallback(() => {
    for (const [id, part] of Object.entries(parts)) {
      if (part.dirty) saveFns.current.get(id)?.()
    }
  }, [parts])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!anchor) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      const next = new URL(anchor.href, window.location.href)
      const here = new URL(window.location.href)
      if (next.origin === here.origin && next.pathname === here.pathname && next.search === here.search) return
      if (!window.confirm('This quotation has unsaved changes. Leave without saving?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])

  const totals = useMemo(() => {
    return estimateTickedLines(
      snapshot.lines.map((line) => ({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: quoteLineTotal(line.quantity, line.unitPrice, snapshot.discountPercent),
      })),
      snapshot.taxPercent,
    )
  }, [snapshot])

  const lineById = useCallback((id: string) => snapshot.lines.find((line) => line.id === id), [snapshot.lines])

  const value = useMemo<QuotationLiveContext>(() => ({
    snapshot,
    totals,
    lineById,
    commitPrice,
    commitQuantity,
    commitHeader,
    registerSaver,
    dirty,
    saving,
    saveAll,
  }), [snapshot, totals, lineById, commitPrice, commitQuantity, commitHeader, registerSaver, dirty, saving, saveAll])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function QuoteSendGuard({ children }: { children: ReactNode }) {
  const { dirty } = useQuotationLive()
  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 ${dirty ? 'opacity-60' : ''}`}
      onClickCapture={(event) => {
        if (!dirty) return
        event.preventDefault()
        event.stopPropagation()
        toast.error('Save the draft before sending this quotation.')
      }}
    >
      {children}
    </div>
  )
}

export function QuotationTotals() {
  const { snapshot, totals } = useQuotationLive()
  return (
    <div className="bg-[#F6F3EC] p-4 border-t border-[#CCC5BD] flex flex-col items-end space-y-2 text-xs">
      <div className="flex justify-between w-64 text-[#4A4640]">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Subtotal ex-GST</span>
        <span className="font-mono text-xs text-[#1C1C18]">{formatCurrency(totals.subtotal)}</span>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between w-64 text-[#3A4537]">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#3A4537]">Discount ({snapshot.discountPercent}%)</span>
          <span className="font-mono text-xs text-[#3A4537]">-{formatCurrency(totals.discount)}</span>
        </div>
      )}
      <div className="flex justify-between w-64 text-[#4A4640]">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">GST ({snapshot.taxPercent || 0}%)</span>
        <span className="font-mono text-xs text-[#1C1C18]">{formatCurrency(totals.tax)}</span>
      </div>
      <div className="flex justify-between w-64 text-sm font-semibold text-[#1C1C18] pt-2 border-t border-[#CCC5BD] mt-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1C18]">Total incl. GST</span>
        <span className="font-mono text-sm font-bold text-[#9E4300]">{formatCurrency(totals.total)}</span>
      </div>
    </div>
  )
}

export function QuotationSaveBar({
  send,
  markSent,
}: {
  send: ReactNode
  markSent: ReactNode
}) {
  const { dirty, saving, saveAll } = useQuotationLive()
  const status = saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'
  return (
    <div className="sticky bottom-0 z-20 border border-[#CCC5BD] bg-[#FCF9F2] p-4 shadow-[0_-8px_24px_rgba(28,27,26,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]" aria-live="polite">
            Draft · {status}
          </p>
          <p className="mt-1 text-xs text-[#4A4640]">
            {dirty
              ? 'Save the draft to update line prices and totals. Sending uses the saved draft.'
              : 'This quotation is saved as a draft. Send it to the client, or mark it sent if you already shared it.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveAll}
            disabled={!dirty || saving}
            className="min-h-10 rounded-none bg-[#1C1B1A] px-4 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] disabled:opacity-50"
          >
            {saving ? 'Saving…' : dirty ? 'Save draft' : 'Draft saved'}
          </button>
          <div className={`flex flex-wrap items-center gap-2 ${dirty || saving ? 'pointer-events-none opacity-50' : ''}`}>
            {send}
            {markSent}
          </div>
        </div>
      </div>
    </div>
  )
}
