import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { CatalogueBrowser } from '@/components/site/catalogue-browser'
import { getPublicCatalogueProducts, getPublicCategories, sanitiseCatalogueSearch } from '@/lib/catalogue/products'
import { isUuid } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Catalogue',
  description: 'Browse the GIFFTER corporate gifting catalogue.',
}

const BUDGETS = [
  { id: '', label: 'Any budget' },
  { id: '0-500', label: 'Under ₹500', min: 0, max: 500 },
  { id: '500-1000', label: '₹500–1,000', min: 500, max: 1000 },
  { id: '500-1500', label: '₹500–1,500', min: 500, max: 1500 },
  { id: '1000-2000', label: '₹1,000–₹2,000', min: 1000, max: 2000 },
  { id: '1500-3000', label: '₹1,500–3,000', min: 1500, max: 3000 },
  { id: '2000-5000', label: '₹2,000–₹5,000', min: 2000, max: 5000 },
  { id: '2000+', label: 'Premium Gifts', min: 2000, max: Infinity },
  { id: '5000+', label: 'Premium', min: 5000, max: Infinity },
  { id: '3000+', label: '₹3,000+', min: 3000, max: Infinity },
] as const

function parseBudget(value: string) {
  return BUDGETS.find((budget) => budget.id === value && 'min' in budget) as
    | { id: string; label: string; min: number; max: number }
    | undefined
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; budget?: string; sort?: string }>
}) {
  const { q = '', category = '', budget = '', sort = 'name' } = await searchParams
  const search = sanitiseCatalogueSearch(q)
  const [products, categories] = await Promise.all([getPublicCatalogueProducts(), getPublicCategories()])
  const categoryFilter = isUuid(category) ? category : ''
  const budgetFilter = parseBudget(budget)

  let filtered = products
  if (search) {
    const needle = search.toLowerCase()
    filtered = filtered.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle) ||
        (product.description || '').toLowerCase().includes(needle) ||
        (product.category_name || '').toLowerCase().includes(needle),
    )
  }
  if (categoryFilter) {
    filtered = filtered.filter((product) => product.category_id === categoryFilter)
  }
  if (budgetFilter) {
    filtered = filtered.filter((product) => {
      const price = product.price || 0
      return price >= budgetFilter.min && price < budgetFilter.max
    })
  }
  if (sort === 'price_low') filtered = [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0))
  else if (sort === 'price_high') filtered = [...filtered].sort((a, b) => (b.price || 0) - (a.price || 0))
  else if (sort === 'newest') {
    filtered = [...filtered].sort(
      (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || a.name.localeCompare(b.name),
    )
  } else filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))

  const hrefFor = (overrides: Record<string, string>) => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (categoryFilter) params.set('category', categoryFilter)
    if (budget) params.set('budget', budget)
    if (sort && sort !== 'name') params.set('sort', sort)
    Object.entries(overrides).forEach(([key, value]) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
    const qs = params.toString()
    return `/catalogue${qs ? `?${qs}` : ''}`
  }

  const budgetChips = [
    { id: '', label: 'Any budget' },
    { id: '0-500', label: 'Under ₹500' },
    { id: '500-1000', label: '₹500–1,000' },
    { id: '1000-2000', label: '₹1,000–₹2,000' },
    { id: '2000+', label: 'Premium Gifts' },
  ]

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#7A7267]">Catalogue</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">The collection.</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6B6358]">
          Every piece below is a live GIFFTER catalogue product — the same records used by the team and client portal.
        </p>

        <form className="mt-8 flex flex-col gap-3 border border-[#E5DFD5] bg-[#FAF7F2]/60 p-4 sm:flex-row sm:items-end">
          {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
          {budget ? <input type="hidden" name="budget" value={budget} /> : null}
          <label className="flex-1">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[#7A7267]">Search</span>
            <input
              name="q"
              defaultValue={search}
              placeholder="Name, category or SKU"
              className="mt-1 w-full border-b border-[#D6CEBE] bg-transparent py-2 text-sm outline-none"
            />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-[0.16em] text-[#7A7267]">Sort</span>
            <select name="sort" defaultValue={sort} className="mt-1 block bg-transparent py-2 text-sm outline-none">
              <option value="name">A–Z</option>
              <option value="newest">Newest</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
            </select>
          </label>
          <button type="submit" className="text-[11px] uppercase tracking-[0.16em] text-[#1A3022]">
            Apply
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={hrefFor({ category: '' })}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] ${
              !categoryFilter ? 'bg-[#1A3022] text-[#FAF7F2]' : 'text-[#5A5248]'
            }`}
          >
            All
          </Link>
          {categories.map((item) => (
            <Link
              key={item.id}
              href={hrefFor({ category: item.id })}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] ${
                categoryFilter === item.id ? 'bg-[#1A3022] text-[#FAF7F2]' : 'text-[#5A5248]'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {budgetChips.map((item) => (
            <Link
              key={item.id || 'any'}
              href={hrefFor({ budget: item.id })}
              className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] ${
                budget === item.id ? 'bg-[#1A3022] text-[#FAF7F2]' : 'text-[#5A5248]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <p className="mt-8 text-xs text-[#7A7267]">{filtered.length} gifts</p>
        <div className="mt-6">
          <CatalogueBrowser products={filtered} />
        </div>
      </div>
    </SiteShell>
  )
}
