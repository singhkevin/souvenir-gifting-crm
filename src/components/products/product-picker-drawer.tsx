'use client'

import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { filterPickerProducts, PICKER_DENSE_PAGE_SIZE, PICKER_PAGE_SIZE, slicePickerPage, stockBadge } from '@/lib/products/picker'

export type PickerProduct = {
  id: string
  name: string
  sku: string
  imageUrl: string | null
  category: string | null
  price: number
  /** False when the pricer has no sell price. Omitted means the price figure is usable. */
  priced?: boolean
  moq: number
  stockQty?: number | null
}

type Selection = { selected: boolean; quantity: string }

function priceLabel(product: PickerProduct) {
  if (product.priced === false) return 'On quote'
  return formatCurrency(product.price)
}

export function ProductPickerDrawer({
  products,
  title = 'Add products',
  description = 'Search, filter, and choose the products and quantities.',
  submitLabel = 'Add selected',
  showQuantity = true,
  defaultQuantity,
  density = 'regular',
  pageSize,
  variant = 'drawer',
  onSubmit,
}: {
  products: PickerProduct[]
  title?: string
  description?: string
  submitLabel?: string
  showQuantity?: boolean
  /** Starting quantity for a newly selected card. Falls back to the product minimum. */
  defaultQuantity?: number
  /** Compact is the requirement products tab: many small cards per row. */
  density?: 'regular' | 'compact'
  pageSize?: number
  /** Drawer for the quotation editor. Panel is the catalog product grid. */
  variant?: 'drawer' | 'panel'
  onSubmit: (rows: { id: string; quantity: number }[]) => Promise<unknown>
}) {
  const resolvedPageSize = pageSize ?? (density === 'compact' ? PICKER_DENSE_PAGE_SIZE : PICKER_PAGE_SIZE)
  const { pending, error, run } = useAction()
  const [open, setOpen] = useState(variant === 'panel')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [rows, setRows] = useState<Record<string, Selection>>({})
  const [visible, setVisible] = useState(resolvedPageSize)
  const filterKey = `${query}|${category}|${minPrice}|${maxPrice}|${resolvedPageSize}`
  const [visibleFilter, setVisibleFilter] = useState(filterKey)
  if (visibleFilter !== filterKey) {
    setVisibleFilter(filterKey)
    setVisible(resolvedPageSize)
  }

  const categories = useMemo(() => {
    return [...new Set(products.map((product) => product.category).filter(Boolean) as string[])].sort()
  }, [products])

  const filtered = useMemo(
    () => filterPickerProducts(products, { query, category, minPrice, maxPrice }),
    [products, query, category, minPrice, maxPrice],
  )
  const page = slicePickerPage(filtered, visible)
  const selectedCount = Object.values(rows).filter((row) => row.selected).length

  function startingQuantity(product: PickerProduct) {
    const preferred = defaultQuantity != null && defaultQuantity > 0 ? defaultQuantity : product.moq || 1
    return String(Math.max(1, Math.round(preferred)))
  }

  function toggle(product: PickerProduct) {
    setRows((current) => {
      const existing = current[product.id]
      return {
        ...current,
        [product.id]: {
          selected: !existing?.selected,
          quantity: existing?.quantity || startingQuantity(product),
        },
      }
    })
  }

  function setQuantity(product: PickerProduct, quantity: number) {
    const next = Math.max(1, Math.round(quantity) || 1)
    setRows((current) => ({
      ...current,
      [product.id]: { selected: true, quantity: String(next) },
    }))
  }

  const body = (
    <div className={variant === 'drawer' ? 'flex h-full w-full max-w-4xl flex-col bg-[#FCF9F2]' : 'overflow-hidden border border-[#CCC5BD] bg-[#FCF9F2]'} role={variant === 'drawer' ? 'dialog' : 'region'} aria-modal={variant === 'drawer' ? true : undefined} aria-labelledby="product-picker-title">
      <div className="flex items-start justify-between gap-3 border-b border-[#CCC5BD] bg-[#F6F3EC] px-4 py-4">
        <div>
          <h2 id="product-picker-title" className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">{title}</h2>
          <p className="mt-1 text-xs text-[#4A4640]">{description}</p>
        </div>
        {variant === 'drawer' ? (
          <button type="button" onClick={() => setOpen(false)} className="rounded-none border border-[#1C1B1A] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#1C1B1A] hover:text-[#FCF9F2]">
            Close
          </button>
        ) : null}
      </div>
      <div className="space-y-3 border-b border-[#CCC5BD] bg-[#FCF9F2] px-4 py-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or SKU"
            aria-label="Search by name or SKU"
            className="min-h-10 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 text-xs text-[#1C1C18] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 sm:col-span-2"
          />
          <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} inputMode="decimal" placeholder="Min price" aria-label="Minimum price" className="min-h-10 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 text-xs font-mono focus:border-[#1C1B1A] focus:outline-none focus:ring-0" />
          <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} inputMode="decimal" placeholder="Max price" aria-label="Maximum price" className="min-h-10 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 text-xs font-mono focus:border-[#1C1B1A] focus:outline-none focus:ring-0" />
        </div>
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categories">
            <CategoryChip active={category === ''} onClick={() => setCategory('')}>All</CategoryChip>
            {categories.map((name) => (
              <CategoryChip key={name} active={category === name} onClick={() => setCategory(category === name ? '' : name)}>
                {name}
              </CategoryChip>
            ))}
          </div>
        ) : null}
      </div>
      <div className={variant === 'drawer' ? 'flex-1 overflow-y-auto p-4' : density === 'compact' ? 'max-h-[75vh] overflow-y-auto p-2' : 'max-h-[36rem] overflow-y-auto p-4'}>
        <p className="mb-2 text-xs text-[#7C766F]">
          {page.items.length} of {filtered.length} products · {selectedCount} selected
        </p>
        {filtered.length === 0 ? <p className="text-sm text-[#7C766F]">No products match these filters.</p> : null}
        <div className={density === 'compact' ? '@container' : undefined}>
        <div className={density === 'compact'
          ? 'grid grid-cols-2 gap-1.5 @min-[28rem]:grid-cols-3 @min-[40rem]:grid-cols-4 @min-[52rem]:grid-cols-6 @min-[64rem]:grid-cols-8 @min-[68rem]:grid-cols-10'
          : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'}>
          {page.items.map((product) => {
            const row = rows[product.id]
            const selected = Boolean(row?.selected)
            const badge = stockBadge(product.stockQty)
            const quantity = Number(row?.quantity || startingQuantity(product))
            if (density === 'compact') {
              return (
                <CompactProductCard
                  key={product.id}
                  product={product}
                  selected={selected}
                  quantity={quantity}
                  quantityValue={row?.quantity || startingQuantity(product)}
                  showQuantity={showQuantity}
                  badge={badge}
                  onToggle={() => toggle(product)}
                  onQuantity={(next) => setQuantity(product, next)}
                  onQuantityText={(value) => {
                    setRows((current) => ({
                      ...current,
                      [product.id]: { selected: true, quantity: value },
                    }))
                  }}
                />
              )
            }
            return (
              <article
                key={product.id}
                className={`flex flex-col border bg-[#FCF9F2] ${selected ? 'border-[#9E4300] bg-[#FFB690]/15' : 'border-[#CCC5BD]'}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(product)}
                  aria-pressed={selected}
                  className="flex flex-1 flex-col text-left"
                >
                  <div className="aspect-square w-full overflow-hidden border-b border-[#CCC5BD] bg-[#F6F3EC]">
                    <ProductImage src={product.imageUrl} alt={product.name} size="md" fit="cover" className="h-full w-full" />
                  </div>
                  <div className="space-y-1 p-2.5">
                    <p className="line-clamp-2 text-sm font-semibold text-[#1C1C18]">{product.name}</p>
                    <p className="truncate font-mono text-[10px] text-[#7C766F]">{product.sku}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs font-semibold text-[#1C1C18]">{priceLabel(product)}</span>
                      {badge ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                          badge.tone === 'out'
                            ? 'bg-[#FBEDEB] text-[#BA1A1A]'
                            : badge.tone === 'low'
                              ? 'bg-[#FFB690]/40 text-[#9E4300]'
                              : 'bg-[#DAE6D3] text-[#3A4537]'
                        }`}>
                          {badge.label}
                        </span>
                      ) : null}
                    </div>
                    <span className={`inline-flex text-[10px] font-bold uppercase tracking-[0.12em] ${selected ? 'text-[#9E4300]' : 'text-[#7C766F]'}`}>
                      {selected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                </button>
                {showQuantity ? (
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#CCC5BD] px-2.5 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Qty</span>
                    <div className="inline-flex items-center border border-[#CCC5BD] bg-[#F6F3EC]">
                      <button
                        type="button"
                        aria-label={`Decrease quantity for ${product.name}`}
                        onClick={() => setQuantity(product, quantity - 1)}
                        className="inline-flex h-8 w-8 items-center justify-center text-[#1C1C18] hover:bg-[#FCF9F2]"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        aria-label={`Quantity for ${product.name}`}
                        value={row?.quantity || startingQuantity(product)}
                        onChange={(event) => {
                          const parsed = Number(event.target.value)
                          if (event.target.value.trim() === '') {
                            setRows((current) => ({
                              ...current,
                              [product.id]: { selected: true, quantity: '' },
                            }))
                            return
                          }
                          if (Number.isFinite(parsed)) setQuantity(product, parsed)
                        }}
                        className="w-12 border-x border-[#CCC5BD] bg-transparent py-1 text-center text-xs font-mono text-[#1C1C18] focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={`Increase quantity for ${product.name}`}
                        onClick={() => setQuantity(product, quantity + 1)}
                        className="inline-flex h-8 w-8 items-center justify-center text-[#1C1C18] hover:bg-[#FCF9F2]"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
        </div>
        {page.remaining > 0 ? (
          <button
            type="button"
            onClick={() => setVisible((count) => count + resolvedPageSize)}
            className="mt-4 min-h-10 w-full rounded-none border border-[#1C1B1A] text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#1C1B1A] hover:text-[#FCF9F2]"
          >
            Show more · {page.remaining} left
          </button>
        ) : null}
      </div>
      <div className="border-t border-[#CCC5BD] bg-[#F6F3EC] px-4 py-3">
        {error ? <p className="mb-2 text-xs text-[#BA1A1A]" role="alert">{error}</p> : null}
        <button
          type="button"
          disabled={pending || selectedCount === 0}
          onClick={() => {
            const chosen = products
              .filter((product) => rows[product.id]?.selected)
              .map((product) => ({
                id: product.id,
                quantity: Math.max(1, Math.round(Number(rows[product.id]?.quantity) || Number(startingQuantity(product)))),
              }))
            run(() => onSubmit(chosen), {
              successMessage: 'Products added',
              onSuccess: () => {
                setRows({})
                if (variant === 'drawer') setOpen(false)
              },
            })
          }}
          className="min-h-11 rounded-none bg-[#1C1B1A] px-4 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] disabled:opacity-50"
        >
          {pending ? <span className="inline-flex items-center gap-2"><Spinner />Adding…</span> : `${submitLabel} (${selectedCount})`}
        </button>
      </div>
    </div>
  )

  if (variant === 'panel') return body

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center rounded-none bg-[#1C1B1A] px-4 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300]"
      >
        {title}
      </button>
      {open ? <div className="fixed inset-0 z-50 flex justify-end bg-black/40">{body}</div> : null}
    </>
  )
}

function CompactProductCard({
  product,
  selected,
  quantity,
  quantityValue,
  showQuantity,
  badge,
  onToggle,
  onQuantity,
  onQuantityText,
}: {
  product: PickerProduct
  selected: boolean
  quantity: number
  quantityValue: string
  showQuantity: boolean
  badge: ReturnType<typeof stockBadge>
  onToggle: () => void
  onQuantity: (quantity: number) => void
  onQuantityText: (value: string) => void
}) {
  const stockText = badge == null ? null : badge.tone === 'out' ? 'Out' : String(product.stockQty)
  return (
    <article className={`flex flex-col gap-1 border p-1.5 ${selected ? 'border-[#9E4300] bg-[#FFB690]/15' : 'border-[#CCC5BD] bg-[#FCF9F2]'}`}>
      <div className="flex items-start gap-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${product.name}`}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#9E4300]"
        />
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-1 text-left">
          <div className="h-8 w-8 shrink-0 overflow-hidden border border-[#CCC5BD] bg-[#F6F3EC]">
            <ProductImage src={product.imageUrl} alt="" size="xs" fit="cover" className="h-full w-full" />
          </div>
          <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-[#1C1C18]">{product.name}</span>
        </button>
      </div>
      <p
        className="truncate font-mono text-[10px] leading-tight text-[#7C766F]"
        title={[product.sku, priceLabel(product), badge?.label].filter(Boolean).join(' · ')}
      >
        {product.sku} · {priceLabel(product)}
        {stockText ? <span className={badge?.tone === 'out' ? 'text-[#BA1A1A]' : badge?.tone === 'low' ? 'text-[#9E4300]' : 'text-[#3A4537]'}> · {stockText}</span> : null}
      </p>
      {showQuantity ? (
        <div className="inline-flex items-center self-start border border-[#CCC5BD] bg-[#F6F3EC]">
          <button
            type="button"
            aria-label={`Decrease quantity for ${product.name}`}
            onClick={() => onQuantity(quantity - 1)}
            className="inline-flex h-5 w-5 items-center justify-center text-[#1C1C18] hover:bg-[#FCF9F2]"
          >
            <Minus size={10} />
          </button>
          <input
            type="number"
            min="1"
            aria-label={`Quantity for ${product.name}`}
            value={quantityValue}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              if (event.target.value.trim() === '') {
                onQuantityText('')
                return
              }
              if (Number.isFinite(parsed)) onQuantity(parsed)
            }}
            className="w-7 border-x border-[#CCC5BD] bg-transparent py-0 text-center text-[10px] font-mono text-[#1C1C18] focus:outline-none"
          />
          <button
            type="button"
            aria-label={`Increase quantity for ${product.name}`}
            onClick={() => onQuantity(quantity + 1)}
            className="inline-flex h-5 w-5 items-center justify-center text-[#1C1C18] hover:bg-[#FCF9F2]"
          >
            <Plus size={10} />
          </button>
        </div>
      ) : null}
    </article>
  )
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-none border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
        active
          ? 'border-[#9E4300] bg-[#FFB690]/30 text-[#9E4300]'
          : 'border-[#CCC5BD] bg-[#F6F3EC] text-[#4A4640] hover:border-[#1C1B1A]'
      }`}
    >
      {children}
    </button>
  )
}
