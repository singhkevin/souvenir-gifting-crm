import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { CatalogueBrowser } from '@/components/site/catalogue-browser'
import { MobileCatalogueFilters } from '@/components/site/mobile-catalogue-filters'
import { getPublicCatalogueProducts, getPublicCategories, sanitiseCatalogueSearch } from '@/lib/catalogue/products'
import { isUuid } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Catalogue',
  description: 'Browse the Gifting Solutions corporate gifting catalogue.',
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

  const categoryCounts = new Map<string, number>()
  for (const product of products) {
    if (!product.category_id) continue
    categoryCounts.set(product.category_id, (categoryCounts.get(product.category_id) || 0) + 1)
  }

  const activeCategoryName = categories.find((item) => item.id === categoryFilter)?.name
  const activeBudgetLabel = budgetChips.find((item) => item.id === budget)?.label
  const hasFilters = Boolean(search || categoryFilter || budget || (sort && sort !== 'name'))

  const filterLinkClass = (active: boolean) =>
    `flex items-center justify-between gap-3 border-l-2 py-2 pl-3 text-sm transition-colors ${
      active
        ? 'border-[#1A3022] font-medium text-[#1A3022]'
        : 'border-transparent text-[#5C6570] hover:border-[#C9C3BA] hover:text-[#1B2430]'
    }`

  return (
    <SiteShell>
      <div className="border-b border-[#E8E4DE] bg-[#F6F4F1]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm text-[#5C6570]">
            <Link href="/home" className="hover:text-[#1A3022]">
              Home
            </Link>
            <span className="mx-2 text-[#C9C3BA]">/</span>
            <span className="text-[#1B2430]">Catalogue</span>
          </p>
          <h1 className="store-section-title mt-3">Catalogue</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#5C6570]">
            Browse live Gifting Solutions gifts — filter by category and budget, then request a quote.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16.5rem_minmax(0,1fr)]">
          {/* Sidebar filters — desktop only; mobile uses sheet filters below */}
          <aside className="hidden lg:sticky lg:top-28 lg:flex lg:max-h-[calc(100vh-8rem)] lg:flex-col lg:self-start lg:overflow-hidden lg:pr-1">
            <div className="min-h-0 flex-1 space-y-8 overflow-y-auto pr-2 [scrollbar-width:thin]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1B2430]">Category</p>
                <nav className="mt-3 space-y-0.5 border-t border-[#E8E4DE] pt-2">
                  <Link href={hrefFor({ category: '' })} className={filterLinkClass(!categoryFilter)}>
                    <span>All gifts</span>
                    <span className="text-xs text-[#8A929C]">{products.length}</span>
                  </Link>
                  {categories.map((item) => (
                    <Link
                      key={item.id}
                      href={hrefFor({ category: item.id })}
                      className={filterLinkClass(categoryFilter === item.id)}
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0 text-xs text-[#8A929C]">{categoryCounts.get(item.id) || 0}</span>
                    </Link>
                  ))}
                </nav>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1B2430]">Shop by price</p>
                <nav className="mt-3 space-y-0.5 border-t border-[#E8E4DE] pt-2">
                  {budgetChips.map((item) => (
                    <Link
                      key={item.id || 'any'}
                      href={hrefFor({ budget: item.id })}
                      className={filterLinkClass(budget === item.id)}
                    >
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#E8E4DE] bg-white pt-4">
              <Link
                href="/catalogue"
                className={`inline-flex min-h-10 w-full items-center text-[12px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  hasFilters
                    ? 'text-[#1A3022] hover:text-[#274433]'
                    : 'pointer-events-none text-[#C4BDB3]'
                }`}
                aria-disabled={!hasFilters}
              >
                Clear all filters
              </Link>
            </div>
          </aside>

          {/* Results */}
          <div className="min-w-0">
            <form className="flex flex-col gap-3 border border-[#E8E4DE] bg-white p-3 sm:flex-row sm:items-center sm:gap-6 sm:p-4">
              {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
              {budget ? <input type="hidden" name="budget" value={budget} /> : null}
              <label className="min-w-0 flex-1">
                <span className="sr-only">Search products</span>
                <input
                  name="q"
                  defaultValue={search}
                  placeholder="Search products"
                  className="w-full bg-transparent py-1 text-base text-[#1B2430] outline-none placeholder:text-[#8A929C] sm:text-sm"
                />
              </label>
              <div className="hidden items-center gap-6 border-l border-[#E8E4DE] pl-6 lg:flex">
                <label className="flex items-center gap-2 text-sm text-[#5C6570]">
                  <span className="whitespace-nowrap">Sort by</span>
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="bg-transparent py-1 text-sm text-[#1B2430] outline-none"
                  >
                    <option value="name">A–Z</option>
                    <option value="newest">Newest</option>
                    <option value="price_low">Price: low to high</option>
                    <option value="price_high">Price: high to low</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="bg-[#1A3022] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                >
                  Apply
                </button>
              </div>
              {sort && sort !== 'name' ? <input type="hidden" name="sort" value={sort} className="lg:hidden" /> : null}
              <button
                type="submit"
                className="bg-[#1A3022] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white lg:hidden"
              >
                Apply
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#1A3022]">
                <span className="font-semibold">{filtered.length}</span>
                <span className="text-[#5C6570]"> {filtered.length === 1 ? 'product' : 'products'}</span>
                {activeCategoryName ? (
                  <span className="text-[#5C6570]"> in {activeCategoryName}</span>
                ) : null}
                {activeBudgetLabel && budget ? (
                  <span className="text-[#5C6570]"> · {activeBudgetLabel}</span>
                ) : null}
                {search ? <span className="text-[#5C6570]"> · “{search}”</span> : null}
              </p>
            </div>

            {/* Mobile filters — clean dropdowns instead of crowded chip rows */}
            <MobileCatalogueFilters
              categories={categories}
              categoryFilter={categoryFilter}
              budget={budget}
              budgetChips={budgetChips}
              search={search}
              sort={sort}
              categoryCounts={Object.fromEntries(categoryCounts)}
              productTotal={products.length}
            />

            <div className="mt-8">
              <CatalogueBrowser products={filtered} />
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  )
}
