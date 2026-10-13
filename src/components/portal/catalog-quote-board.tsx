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
    <div className="pb-24 lg:pb-0">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.title || 'catalog'}>
              {group.title ? <h2 className="text-sm font-semibold text-gray-900">{group.title}</h2> : null}
              <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${group.title ? 'mt-4' : ''}`}>
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

        <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto lg:block">
          <QuoteBasket {...basketProps} />
        </aside>
      </div>

      <>
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5DFD5] bg-white px-3 py-3 shadow-[0_-8px_24px_rgba(36,28,18,0.06)] lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-[#806A50] px-4 text-sm font-semibold text-white"
              aria-expanded={drawerOpen}
            >
              <span>Quote · {lines.length} {lines.length === 1 ? 'item' : 'items'}</span>
              <span>{estimateLabel(estimate, lines.length)}</span>
            </button>
          </div>

          {drawerOpen ? (
            <div className="fixed inset-0 z-[60] lg:hidden">
              <button
                type="button"
                aria-label="Close quote"
                className="absolute inset-0 bg-black/40"
                onClick={() => setDrawerOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Quote"
                className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-gray-900">Your quote</h2>
                  <button
                    type="button"
                    aria-label="Close quote"
                    onClick={() => setDrawerOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F6F4F1] text-[#5C6570]"
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
    <article className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="relative">
        <Link href={`/portal/gifts/${item.id}`} className="block">
          <ProductImage src={item.imageUrl} alt={item.name} size="md" />
        </Link>
        <ShortlistHeart item={item} />
      </div>
      <div className="flex flex-1 flex-col p-4">
        {item.eyebrow ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#806A50]">{item.eyebrow}</p>
        ) : null}
        <Link href={`/portal/gifts/${item.id}`}>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900 hover:text-[#806A50]">{item.name}</h3>
        </Link>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.description}</p>
        ) : null}
        {item.includes.length > 1 ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-gray-500">Includes {item.includes.join(', ')}</p>
        ) : null}

        <div className="mt-auto space-y-3 border-t border-gray-100 pt-3">
          <div>
            <p className="text-base font-semibold text-gray-900">
              {item.price == null ? 'Price on request' : formatCurrency(item.price)}
            </p>
            <p className="text-[10px] text-gray-400">Per person · MOQ {item.moq}</p>
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
              className={`inline-flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-3 text-xs font-semibold ${
                added
                  ? 'border border-[#806A50] bg-[#806A50]/10 text-[#806A50]'
                  : 'bg-[#806A50] text-white hover:bg-[#9C8567]'
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
      className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        within ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
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
    <div className="flex h-10 shrink-0 items-center rounded-lg border border-[#E5DFD5] bg-white">
      <button
        type="button"
        aria-label={`Decrease quantity for ${label}`}
        disabled={qty <= moq}
        onClick={() => onCommit(qty - 1)}
        className="flex h-10 w-8 items-center justify-center text-gray-600 disabled:text-gray-300"
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
        className="w-12 border-0 bg-transparent text-center text-sm text-gray-900 outline-none"
      />
      <button
        type="button"
        aria-label={`Increase quantity for ${label}`}
        disabled={qty >= 100000}
        onClick={() => onCommit(qty + 1)}
        className="flex h-10 w-8 items-center justify-center text-gray-600 disabled:text-gray-300"
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
      className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors disabled:opacity-60 ${
        saved ? 'text-[#806A50]' : 'text-gray-500 hover:text-[#806A50]'
      }`}
    >
      <Heart size={16} className={saved ? 'fill-current' : ''} />
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
    <section className="rounded-2xl border border-[#E5DFD5] bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-[#1C1917]">Your quote</h2>
      <p className="mt-1 text-xs text-[#5A5248]">
        Quantities start at the minimum order. One request covers everything added here.
      </p>

      {lines.length === 0 ? (
        <p className="mt-4 rounded-lg bg-[#FAF7F2] px-3 py-4 text-sm text-[#5A5248]">
          No gifts added yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[#E8E4DE]">
          {lines.map(({ item, quantity }) => (
            <li key={item.id} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium text-[#1C1917]">
                  <span className="line-clamp-2">{item.name}</span>
                  <span className="mt-0.5 block text-xs font-normal text-[#7A7267]">
                    {item.price == null ? 'Price on request' : formatCurrency(item.price)} per person
                  </span>
                </p>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemove(item.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-2">
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

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-[#E8E4DE] pt-3">
        <span className="text-sm text-[#5A5248]">Estimated total</span>
        <span className="text-base font-semibold text-[#1C1917]">{estimateLabel(estimate, lines.length)}</span>
      </div>
      {estimate.unpriced > 0 && lines.length > 0 && estimate.unpriced < lines.length ? (
        <p className="mt-1 text-[11px] text-[#7A7267]">Some prices are confirmed on the quotation.</p>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium text-[#1C1917]">Delivery date</span>
        <input
          type="date"
          value={deadline}
          onChange={(event) => onDeadline(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-[#E8E4DE] px-3"
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="mb-1 block font-medium text-[#1C1917]">Notes</span>
        <textarea
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
          rows={3}
          placeholder="Branding, delivery city, or anything else we should know"
          className="w-full rounded-lg border border-[#E8E4DE] px-3 py-2"
        />
      </label>
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || lines.length === 0}
        aria-busy={pending || undefined}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#806A50] px-5 text-sm font-semibold text-white hover:bg-[#9C8567] disabled:cursor-not-allowed disabled:opacity-50"
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
