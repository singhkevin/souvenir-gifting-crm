import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandName } from '@/components/brand/brand-name'
import { SiteShell } from '@/components/site/site-shell'
import { CatalogueBrowser } from '@/components/site/catalogue-browser'
import { MobileCatalogueFilters } from '@/components/site/mobile-catalogue-filters'
import { PriceRangeFilter } from '@/components/site/price-range-filter'
import {
  getPublicCatalogueProducts,
  getPublicCategories,
  getPublicBrands,
  sanitiseCatalogueSearch,
} from '@/lib/catalogue/products'
import { formatCurrency, isUuid } from '@/lib/utils'
import { appName } from '@/lib/brand'
import { STORE_OCCASIONS } from '@/lib/catalogue/storefront'

export const metadata: Metadata = {
  title: 'Catalogue',
  description: `Browse the ${appName()} corporate gifting catalogue.`,
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    category?: string
    brand?: string
    priceMin?: string
    priceMax?: string
    sort?: string
    occasion?: string
  }>
}) {
  const { q = '', category = '', brand = '', priceMin = '', priceMax = '', sort = 'name', occasion = '' } = await searchParams
  const search = sanitiseCatalogueSearch(q)
  const [products, categories, brands] = await Promise.all([
    getPublicCatalogueProducts(),
    getPublicCategories(),
    getPublicBrands(),
  ])
  const categoryFilter = isUuid(category) ? category : ''
  const brandFilter = isUuid(brand) ? brand : ''
  const occasionFilter = STORE_OCCASIONS.some((item) => item.id === occasion) ? occasion : ''

  const priceBounds = {
    min: 0,
    max: Math.max(100, Math.ceil((Math.max(0, ...products.map((p) => p.price || 0)) || 100) / 100) * 100),
  }
  const priceMinFilter = Math.max(priceBounds.min, Number(priceMin) || priceBounds.min)
  const priceMaxFilter = priceMax ? Math.min(priceBounds.max, Number(priceMax) || priceBounds.max) : priceBounds.max
  const priceIsFiltered = priceMinFilter > priceBounds.min || priceMaxFilter < priceBounds.max

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
  if (brandFilter) {
    filtered = filtered.filter((product) => product.brand_id === brandFilter)
  }
  if (occasionFilter) {
    filtered = filtered.filter((product) => product.occasion_tags.includes(occasionFilter))
  }
  if (priceIsFiltered) {
    filtered = filtered.filter((product) => {
      const price = product.price || 0
      return price >= priceMinFilter && price <= priceMaxFilter
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
    if (brandFilter) params.set('brand', brandFilter)
    if (occasionFilter) params.set('occasion', occasionFilter)
    if (priceMinFilter > priceBounds.min) params.set('priceMin', String(priceMinFilter))
    if (priceMaxFilter < priceBounds.max) params.set('priceMax', String(priceMaxFilter))
    if (sort && sort !== 'name') params.set('sort', sort)
    Object.entries(overrides).forEach(([key, value]) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
    const qs = params.toString()
    return `/catalogue${qs ? `?${qs}` : ''}`
  }

  const categoryCounts = new Map<string, number>()
  const brandCounts = new Map<string, number>()
  for (const product of products) {
    if (product.category_id) categoryCounts.set(product.category_id, (categoryCounts.get(product.category_id) || 0) + 1)
    if (product.brand_id) brandCounts.set(product.brand_id, (brandCounts.get(product.brand_id) || 0) + 1)
  }

  const activeCategoryName = categories.find((item) => item.id === categoryFilter)?.name
  const activeBrandName = brands.find((item) => item.id === brandFilter)?.name
  const hasFilters = Boolean(
    search || categoryFilter || brandFilter || occasionFilter || priceIsFiltered || (sort && sort !== 'name'),
  )

  const filterLinkClass = (active: boolean) =>
    `flex items-center justify-between gap-3 border-l-2 py-2 pl-3 text-sm transition-colors ${
      active
        ? 'border-[#9E4300] bg-[#F6F3EC] font-semibold text-[#1C1B1A]'
        : 'border-transparent text-[#4A4640] hover:border-[#CCC5BD] hover:bg-[#F6F3EC] hover:text-[#1C1B1A]'
    }`

  return (
    <SiteShell>
      <div className="border-b border-[#3A3835] bg-[#1C1B1A] text-[#FCF9F2]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-xs uppercase tracking-wider text-[#FFB690]">
            <Link href="/home" className="hover:underline">
              Home
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <span className="text-[#FCF9F2]">Catalogue</span>
            {activeCategoryName ? (
              <>
                <span className="mx-2 text-[#7C766F]">/</span>
                <span className="text-[#FFB690]">{activeCategoryName}</span>
              </>
            ) : null}
          </p>
          <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-serif text-3xl font-normal tracking-tight text-[#FCF9F2] sm:text-4xl lg:text-5xl">
                {activeCategoryName || activeBrandName || 'Catalogue'}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#CCC5BD]">
                Live collection of gifts — filter by category, brand and price, then request a quotation.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16.5rem_minmax(0,1fr)]">
          {/* Sidebar filters — desktop only; mobile uses sheet filters below */}
          <aside className="hidden lg:sticky lg:top-28 lg:flex lg:max-h-[calc(100vh-8rem)] lg:flex-col lg:self-start lg:overflow-hidden lg:pr-1">
            <div className="min-h-0 flex-1 space-y-8 overflow-y-auto pr-2 [scrollbar-width:thin]">
              <div>
                <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#1C1B1A]">Category</p>
                <nav className="mt-3 space-y-0.5 border-t border-[#CCC5BD] pt-2">
                  <Link href={hrefFor({ category: '' })} className={filterLinkClass(!categoryFilter)}>
                    <span>All gifts</span>
                    <span className="font-mono text-xs text-[#7C766F]">{products.length}</span>
                  </Link>
                  {categories.map((item) => (
                    <Link
                      key={item.id}
                      href={hrefFor({ category: item.id })}
                      className={filterLinkClass(categoryFilter === item.id)}
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="shrink-0 font-mono text-xs text-[#7C766F]">{categoryCounts.get(item.id) || 0}</span>
                    </Link>
                  ))}
                </nav>
              </div>

              {brands.length ? (
                <div>
                  <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#1C1B1A]">Brand</p>
                  <nav className="mt-3 space-y-0.5 border-t border-[#CCC5BD] pt-2">
                    <Link href={hrefFor({ brand: '' })} className={filterLinkClass(!brandFilter)}>
                      <span>All brands</span>
                    </Link>
                    {brands.map((item) => (
                      <Link
                        key={item.id}
                        href={hrefFor({ brand: item.id })}
                        className={filterLinkClass(brandFilter === item.id)}
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="shrink-0 font-mono text-xs text-[#7C766F]">{brandCounts.get(item.id) || 0}</span>
                      </Link>
                    ))}
                  </nav>
                </div>
              ) : null}

              <div>
                <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#1C1B1A]">Price</p>
                <div className="mt-3 border-t border-[#CCC5BD] pt-4">
                  <PriceRangeFilter
                    key={`${priceMinFilter}-${priceMaxFilter}`}
                    bounds={priceBounds}
                    value={{ min: priceMinFilter, max: priceMaxFilter }}
                    basePath="/catalogue"
                    preserveParams={{
                      q: search,
                      category: categoryFilter,
                      brand: brandFilter,
                      occasion: occasionFilter,
                      sort: sort !== 'name' ? sort : '',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#CCC5BD] bg-[#FCF9F2] pt-4">
              <Link
                href="/catalogue"
                className={`inline-flex min-h-10 w-full items-center font-sans text-xs font-semibold uppercase tracking-wider transition-colors ${
                  hasFilters
                    ? 'text-[#9E4300] hover:underline'
                    : 'pointer-events-none text-[#CCC5BD]'
                }`}
                aria-disabled={!hasFilters}
              >
                Clear all filters
              </Link>
            </div>
          </aside>

          {/* Results */}
          <div className="min-w-0">
            <form className="flex flex-col gap-3 border border-[#CCC5BD] bg-[#FCF9F2] p-3 sm:flex-row sm:items-center sm:gap-6 sm:p-4">
              {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
              {brandFilter ? <input type="hidden" name="brand" value={brandFilter} /> : null}
              {occasionFilter ? <input type="hidden" name="occasion" value={occasionFilter} /> : null}
              {priceMinFilter > priceBounds.min ? (
                <input type="hidden" name="priceMin" value={priceMinFilter} />
              ) : null}
              {priceMaxFilter < priceBounds.max ? (
                <input type="hidden" name="priceMax" value={priceMaxFilter} />
              ) : null}
              <label className="min-w-0 flex-1">
                <span className="sr-only">Search products</span>
                <input
                  name="q"
                  defaultValue={search}
                  placeholder="Search products..."
                  className="w-full bg-transparent py-1 text-sm text-[#1C1B1A] outline-none placeholder:text-[#7C766F]"
                />
              </label>
              <div className="hidden items-center gap-6 border-l border-[#CCC5BD] pl-6 lg:flex">
                <label className="flex items-center gap-2 text-xs font-mono uppercase text-[#4A4640]">
                  <span className="whitespace-nowrap">Sort by</span>
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="border border-[#CCC5BD] bg-[#FCF9F2] py-1.5 px-3 text-xs font-mono uppercase text-[#1C1B1A] outline-none focus:border-[#1C1B1A]"
                  >
                    <option value="name">A–Z</option>
                    <option value="newest">Newest</option>
                    <option value="price_low">Price: low to high</option>
                    <option value="price_high">Price: high to low</option>
                  </select>
                </label>
                <button
                  type="submit"
                  className="bg-[#000000] hover:bg-[#9E4300] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#FCF9F2] transition-colors"
                >
                  Apply
                </button>
              </div>
              {sort && sort !== 'name' ? <input type="hidden" name="sort" value={sort} className="lg:hidden" /> : null}
              <button
                type="submit"
                className="bg-[#000000] hover:bg-[#9E4300] px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[#FCF9F2] transition-colors lg:hidden"
              >
                Apply
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={hrefFor({ occasion: '' })}
                className={`border px-3 py-1 font-mono text-xs tracking-wider transition-colors ${
                  occasionFilter
                    ? 'border-[#CCC5BD] bg-[#FCF9F2] text-[#4A4640] hover:border-[#1C1B1A]'
                    : 'border-[#1C1B1A] bg-[#1C1B1A] text-[#FCF9F2]'
                }`}
              >
                All occasions
              </Link>
              {STORE_OCCASIONS.map((item) => (
                <Link
                  key={item.id}
                  href={hrefFor({ occasion: item.id })}
                  className={`border px-3 py-1 font-mono text-xs tracking-wider transition-colors ${
                    occasionFilter === item.id
                      ? 'border-[#1C1B1A] bg-[#1C1B1A] text-[#FCF9F2]'
                      : 'border-[#CCC5BD] bg-[#FCF9F2] text-[#4A4640] hover:border-[#1C1B1A]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-[#4A4640]">
              <p>
                Showing <span className="font-bold text-[#1C1B1A]">{filtered.length}</span> {filtered.length === 1 ? 'gift' : 'gifts'}
                {activeCategoryName ? (
                  <span> in {activeCategoryName}</span>
                ) : null}
                {activeBrandName ? <span> · {activeBrandName}</span> : null}
                {priceIsFiltered ? (
                  <span>
                    {' '}
                    · {formatCurrency(priceMinFilter)} – {formatCurrency(priceMaxFilter)}
                  </span>
                ) : null}
                {search ? <span> · “{search}”</span> : null}
              </p>
            </div>

            {/* Mobile filters — clean dropdowns instead of crowded chip rows */}
            <MobileCatalogueFilters
              categories={categories}
              categoryFilter={categoryFilter}
              brands={brands}
              brandFilter={brandFilter}
              priceBounds={priceBounds}
              priceMin={priceMinFilter}
              priceMax={priceMaxFilter}
              search={search}
              sort={sort}
              categoryCounts={Object.fromEntries(categoryCounts)}
              brandCounts={Object.fromEntries(brandCounts)}
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
