'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, Minus, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ProductImage } from '@/components/ui/product-image'
import { Spinner } from '@/components/ui/submit-button'
import { requestCatalogQuotation } from '@/app/portal/actions'
import { toggleOfferingSelection } from '@/app/portal/catalogue/actions'
import { budgetBadge, clampQuoteQty, quoteEstimate, type BudgetBadge } from '@/lib/portal/catalog-quote'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { formatCurrency } from '@/lib/utils'
import { ProductThumb } from '@/components/ui/product-thumb'

export type CatalogQuoteItem = {
  id: string
  name: string
  description: string
  imageUrl: string | null
  price: number | null
  moq: number
  campaignId: string
  shortlisted: boolean
  eyebrow: string | null
  includes: string[]
}

type BasketLine = { item: CatalogQuoteItem; quantity: number }

export function CatalogQuoteBoard({
  catalogId,
  budget,
  groups,
}: {
  catalogId: string
  budget: number | null
  groups: { title?: string; items: CatalogQuoteItem[] }[]
}) {
  const router = useRouter()
  const { pending, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [basket, setBasket] = useState<Record<string, number>>({})
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const items = useMemo(() => groups.flatMap((group) => group.items), [groups])
  const lines: BasketLine[] = items
    .filter((item) => basket[item.id] != null)
    .map((item) => ({ item, quantity: basket[item.id] }))
  const estimate = quoteEstimate(lines.map((line) => ({ price: line.item.price, quantity: line.quantity })))

  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const setQuantity = (id: string, moq: number, quantity: number) => {
    setBasket((current) => ({ ...current, [id]: clampQuoteQty(quantity, moq) }))
  }

  const add = (item: CatalogQuoteItem, quantity: number) => {
    setBasket((current) => ({ ...current, [item.id]: clampQuoteQty(quantity, item.moq) }))
  }

  const remove = (id: string) => {
    setBasket((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  const submit = () => {
    if (!lines.length) {
      toast.error('Add at least one gift to the quote')
      return
    }
    run(
      () =>
        requestCatalogQuotation({
          catalogId,
          deadline,
          notes,
          lines: lines.map((line) => ({ id: line.item.id, quantity: line.quantity })),
          idempotencyKey: key,
        }),
      {
        successMessage: 'Request for quotation sent',
        onSuccess: () => {
          rotate()
          router.push('/portal/quotes')
        },
      },
    )
  }

  const basketProps = {
    lines,
    estimate,
    deadline,
    notes,
    pending,
    onDeadline: setDeadline,
    onNotes: setNotes,
    onQuantity: setQuantity,
    onRemove: remove,
    onSubmit: submit,
  }

  return (
    <div className="pb-24 lg:pb-0 min-w-0">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="space-y-10 min-w-0">
          {groups.map((group) => (
            <section key={group.title || 'catalog'} className="space-y-4">
              {group.title ? (
                <div className="border-b border-[#CCC5BD] pb-2">
                  <h2 className="font-serif text-2xl text-[#1C1C18]">{group.title}</h2>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <CatalogQuoteCard
                    key={item.id}
                    item={item}
                    budget={budget}
                    quantity={basket[item.id]}
                    onAdd={add}
                    onQuantity={setQuantity}
                    onRemove={remove}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Desktop Sticky Basket */}
        <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto lg:block">
          <QuoteBasket {...basketProps} />
        </aside>
      </div>

      {/* Mobile Floating Drawer Trigger */}
      <>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#CCC5BD] bg-[#FCF9F2] px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-h-12 w-full items-center justify-between gap-3 bg-[#9E4300] px-4 text-xs font-bold uppercase tracking-[0.12em] text-white rounded-none"
            aria-expanded={drawerOpen}
          >
            <span>Quote · {lines.length} {lines.length === 1 ? 'item' : 'items'}</span>
            <span className="font-mono">{estimateLabel(estimate, lines.length)}</span>
          </button>
        </div>

        {drawerOpen ? (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <button
              type="button"
              aria-label="Close quote"
              className="absolute inset-0 bg-black/60"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Quote"
              className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto border-t border-[#CCC5BD] bg-[#FCF9F2] p-4 rounded-none"
            >
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#CCC5BD] pb-3">
                <h2 className="font-serif text-xl text-[#1C1C18]">Your quote</h2>
                <button
                  type="button"
                  aria-label="Close quote"
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center border border-[#CCC5BD] bg-white text-[#1C1C18] rounded-none hover:bg-[#F6F3EC]"
                >
                  <X size={16} />
                </button>
              </div>
              <QuoteBasket {...basketProps} />
            </div>
          </div>
        ) : null}
      </>
    </div>
  )
}

function estimateLabel(estimate: { total: number; unpriced: number }, count: number) {
  if (count === 0) return formatCurrency(0)
  if (estimate.unpriced === count) return 'On request'
  return formatCurrency(estimate.total)
}

function CatalogQuoteCard({
  item,
  budget,
  quantity,
  onAdd,
  onQuantity,
  onRemove,
}: {
  item: CatalogQuoteItem
  budget: number | null
  quantity: number | undefined
  onAdd: (item: CatalogQuoteItem, quantity: number) => void
  onQuantity: (id: string, moq: number, quantity: number) => void
  onRemove: (id: string) => void
}) {
  const added = quantity != null
  const [draftQty, setDraftQty] = useState(item.moq)
  const qty = added ? quantity : draftQty
  const badge = budgetBadge(item.price, budget)

  const commit = (value: number) => {
    const next = clampQuoteQty(value, item.moq)
    if (added) onQuantity(item.id, item.moq, next)
    else setDraftQty(next)
  }

  return (
    <article className="flex flex-col border border-[#CCC5BD] bg-white rounded-none">
      <div className="relative">
        <Link href={`/portal/gifts/${item.id}`} className="block">
          <ProductImage src={item.imageUrl} alt={item.name} size="md" className="rounded-none border-b border-[#CCC5BD]" />
        </Link>
        <ShortlistHeart item={item} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        {item.eyebrow ? (
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">{item.eyebrow}</p>
        ) : null}
        <Link href={`/portal/gifts/${item.id}`}>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-[#1C1C18] hover:text-[#9E4300] transition-colors">
            {item.name}
          </h3>
        </Link>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-[#4A4640]">{item.description}</p>
        ) : null}
        {item.includes.length > 1 ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-[#7C766F]">Includes {item.includes.join(', ')}</p>
        ) : null}

        <div className="mt-auto space-y-3 pt-4 border-t border-[#CCC5BD]">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="font-mono text-base font-semibold text-[#1C1C18]">
                {item.price == null ? 'Price on request' : formatCurrency(item.price)}
              </p>
              <p className="font-mono text-[10px] text-[#7C766F]">Per person · MOQ {item.moq}</p>
            </div>
            {badge ? <BudgetPill badge={badge} /> : null}
          </div>

          <div className="flex items-center gap-2">
            <QtyStepper
              qty={qty}
              moq={item.moq}
              label={item.name}
              onCommit={commit}
            />
            <button
              type="button"
              onClick={() => (added ? onRemove(item.id) : onAdd(item, qty))}
              aria-pressed={added}
              aria-label={added ? `Remove ${item.name} from quote` : `Add ${item.name} to quote`}
              className={`inline-flex min-h-10 min-w-0 flex-1 items-center justify-center px-3 text-xs font-bold uppercase tracking-[0.12em] rounded-none transition-colors ${
                added
                  ? 'border border-[#9E4300] bg-[#FFDBCB]/30 text-[#9E4300]'
                  : 'bg-[#1C1B1A] text-white hover:bg-[#9E4300]'
              }`}
            >
              {added ? 'Added' : 'Add to quote'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function BudgetPill({ badge }: { badge: BudgetBadge }) {
  const within = badge === 'within'
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px]  uppercase tracking-wider rounded-none border ${
        within
          ? 'border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]'
          : 'border-[#9E4300] bg-[#FFDBCB]/40 text-[#9E4300]'
      }`}
    >
      {within ? 'Within budget' : 'Over budget'}
    </span>
  )
}

function QtyStepper({
  qty,
  moq,
  label,
  onCommit,
}: {
  qty: number
  moq: number
  label: string
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState(String(qty))

  useEffect(() => {
    setText(String(qty))
  }, [qty])

  return (
    <div className="flex h-10 shrink-0 items-center border border-[#CCC5BD] bg-[#F1EEE7] rounded-none">
      <button
        type="button"
        aria-label={`Decrease quantity for ${label}`}
        disabled={qty <= moq}
        onClick={() => onCommit(qty - 1)}
        className="flex h-10 w-8 items-center justify-center text-[#1C1C18] hover:bg-[#EBE8E1] disabled:text-[#CCC5BD] transition-colors"
      >
        <Minus size={14} />
      </button>
      <input
        aria-label={`Quantity for ${label}`}
        inputMode="numeric"
        value={text}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d]/g, '')
          setText(next)
          if (!next) return
          const parsed = Number.parseInt(next, 10)
          if (parsed >= moq) onCommit(parsed)
        }}
        onBlur={() => onCommit(text ? Number.parseInt(text, 10) : moq)}
        className="w-12 border-0 bg-transparent text-center font-mono text-xs text-[#1C1C18] outline-none"
      />
      <button
        type="button"
        aria-label={`Increase quantity for ${label}`}
        disabled={qty >= 100000}
        onClick={() => onCommit(qty + 1)}
        className="flex h-10 w-8 items-center justify-center text-[#1C1C18] hover:bg-[#EBE8E1] disabled:text-[#CCC5BD] transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

function ShortlistHeart({ item }: { item: CatalogQuoteItem }) {
  const [saved, setSaved] = useState(item.shortlisted)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setSaved(item.shortlisted)
  }, [item.shortlisted])

  const toggle = async () => {
    if (pending) return
    const next = !saved
    setSaved(next)
    setPending(true)
    const formData = new FormData()
    formData.set('campaign_id', item.campaignId)
    formData.set('campaign_product_id', item.id)
    formData.set('kind', 'shortlisted')
    if (!next) formData.set('remove', '1')
    const result = await toggleOfferingSelection(formData)
    setPending(false)
    if (result?.error) {
      setSaved(!next)
      toast.error(result.error)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${item.name} from quote basket` : `Save ${item.name} to quote basket`}
      className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center border border-[#CCC5BD] bg-white/95 transition-colors rounded-none disabled:opacity-60 ${
        saved ? 'text-[#9E4300]' : 'text-[#7C766F] hover:text-[#9E4300]'
      }`}
    >
      <Heart size={15} className={saved ? 'fill-current' : ''} />
    </button>
  )
}

function QuoteBasket({
  lines,
  estimate,
  deadline,
  notes,
  pending,
  onDeadline,
  onNotes,
  onQuantity,
  onRemove,
  onSubmit,
}: {
  lines: BasketLine[]
  estimate: { total: number; unpriced: number }
  deadline: string
  notes: string
  pending: boolean
  onDeadline: (value: string) => void
  onNotes: (value: string) => void
  onQuantity: (id: string, moq: number, quantity: number) => void
  onRemove: (id: string) => void
  onSubmit: () => void
}) {
  return (
    <section className="border border-[#CCC5BD] bg-[#FCF9F2] p-5 rounded-none space-y-4">
      <div>
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
          Selection
        </span>
        <h2 className="font-serif text-xl text-[#1C1C18]">Your quote</h2>
        <p className="mt-1 text-xs text-[#4A4640]">
          Quantities start at the minimum order. One request covers everything added here.
        </p>
      </div>

      {lines.length === 0 ? (
        <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-4 text-center text-xs text-[#7C766F] rounded-none">
          No gifts added yet.
        </div>
      ) : (
        <ul className="border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
          {lines.map(({ item, quantity }) => (
            <li key={item.id} className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <ProductThumb src={item.imageUrl} alt={item.name} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#1C1C18] line-clamp-2">{item.name}</p>
                  <p className="font-mono text-[10px] text-[#7C766F] mt-0.5">
                    {item.price == null ? 'Price on request' : formatCurrency(item.price)} per person
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemove(item.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center text-[#7C766F] hover:text-[#BA1A1A] transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="pt-1">
                <QtyStepper
                  qty={quantity}
                  moq={item.moq}
                  label={item.name}
                  onCommit={(value) => onQuantity(item.id, item.moq, value)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Estimation Block */}
      <div className="border border-[#CCC5BD] bg-white p-3 rounded-none space-y-1">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
            Estimated total
          </span>
          <span className="font-mono font-bold text-base text-[#1C1C18]">
            {estimateLabel(estimate, lines.length)}
          </span>
        </div>
        {estimate.unpriced > 0 && lines.length > 0 && estimate.unpriced < lines.length ? (
          <p className="text-[10px] text-[#7C766F]">Some prices are confirmed on the quotation.</p>
        ) : null}
      </div>

      {/* Inputs */}
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
            Delivery date
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(event) => onDeadline(event.target.value)}
            className="w-full bg-[#F1EEE7] border border-[#CCC5BD] px-3 py-2 text-xs font-mono text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(event) => onNotes(event.target.value)}
            rows={3}
            placeholder="Branding, delivery city, or anything else we should know"
            className="w-full bg-[#F1EEE7] border border-[#CCC5BD] px-3 py-2 text-xs text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none placeholder:text-[#7C766F]"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || lines.length === 0}
        aria-busy={pending || undefined}
        className="w-full inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] bg-[#9E4300] hover:bg-[#FF8843] text-white rounded-none disabled:opacity-50 transition-colors"
      >
        {pending ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Spinner />
            Submitting…
          </span>
        ) : (
          'Request quotation'
        )}
      </button>
    </section>
  )
}
