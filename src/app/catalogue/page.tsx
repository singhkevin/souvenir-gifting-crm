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

  const chipClass = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
      active
        ? 'border-[#1A3022] bg-[#1A3022] text-white'
        : 'border-[#E8E4DE] bg-white text-[#5C6570] hover:border-[#1A3022] hover:text-[#1B2430]'
    }`

  return (
    <SiteShell>
      <div className="border-b border-[#E8E4DE] bg-[#F6F4F1]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="store-eyebrow">Shop</p>
          <h1 className="store-section-title mt-2">Catalogue</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#5C6570]">
            Every piece below is a live GIFFTER catalogue product — the same records used by the team and client portal.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <form className="flex flex-col gap-3 rounded-md border border-[#E8E4DE] bg-white p-4 sm:flex-row sm:items-end">
          {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
          {budget ? <input type="hidden" name="budget" value={budget} /> : null}
          <label className="flex-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#5C6570]">Search</span>
            <input
              name="q"
              defaultValue={search}
              placeholder="Name, category or SKU"
              className="mt-1 w-full border-b border-[#E8E4DE] bg-transparent py-2 text-sm outline-none focus:border-[#1A3022]"
            />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#5C6570]">Sort</span>
            <select name="sort" defaultValue={sort} className="mt-1 block bg-transparent py-2 text-sm outline-none">
              <option value="name">A–Z</option>
              <option value="newest">Newest</option>
              <option value="price_low">Price: low to high</option>
              <option value="price_high">Price: high to low</option>
            </select>
          </label>
          <button
            type="submit"
            className="bg-[#1A3022] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
          >
            Apply
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={hrefFor({ category: '' })} className={chipClass(!categoryFilter)}>
            All
          </Link>
          {categories.map((item) => (
            <Link key={item.id} href={hrefFor({ category: item.id })} className={chipClass(categoryFilter === item.id)}>
              {item.name}
            </Link>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {budgetChips.map((item) => (
            <Link key={item.id || 'any'} href={hrefFor({ budget: item.id })} className={chipClass(budget === item.id)}>
              {item.label}
            </Link>
          ))}
        </div>

        <p className="mt-8 text-xs text-[#5C6570]">{filtered.length} gifts</p>
        <div className="mt-6">
          <CatalogueBrowser products={filtered} />
        </div>
      </div>
    </SiteShell>
  )
}
