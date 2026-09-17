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

export const metadata: Metadata = {
  title: 'Catalogue',
  description: 'Browse the Souvenir - Gifting Solutions corporate gifting catalogue.',
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
  }>
}) {
  const { q = '', category = '', brand = '', priceMin = '', priceMax = '', sort = 'name' } = await searchParams
  const search = sanitiseCatalogueSearch(q)
  const [products, categories, brands] = await Promise.all([
    getPublicCatalogueProducts(),
    getPublicCategories(),
    getPublicBrands(),
  ])
  const categoryFilter = isUuid(category) ? category : ''
  const brandFilter = isUuid(brand) ? brand : ''

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
    search || categoryFilter || brandFilter || priceIsFiltered || (sort && sort !== 'name'),
  )

  const filterLinkClass = (active: boolean) =>
    `flex items-center justify-between gap-3 border-l-2 py-2 pl-3 text-sm transition-colors ${
      active
        ? 'border-[#806A50] font-medium text-[#806A50]'
        : 'border-transparent text-[#5C6570] hover:border-[#C9C3BA] hover:text-[#1B2430]'
    }`

  return (
    <SiteShell>
      <div className="border-b border-[#E8E4DE] bg-[#F6F4F1]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-sm text-[#5C6570]">
            <Link href="/home" className="hover:text-[#806A50]">
              Home
            </Link>
            <span className="mx-2 text-[#C9C3BA]">/</span>
            <span className="text-[#1B2430]">Catalogue</span>
          </p>
          <h1 className="store-section-title mt-3">Catalogue</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#5C6570]">
            Browse live <BrandName /> gifts — filter by category, brand and price, then request a quote.
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

              {brands.length ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1B2430]">Brand</p>
                  <nav className="mt-3 space-y-0.5 border-t border-[#E8E4DE] pt-2">
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
                        <span className="shrink-0 text-xs text-[#8A929C]">{brandCounts.get(item.id) || 0}</span>
                      </Link>
                    ))}
                  </nav>
                </div>
              ) : null}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1B2430]">Price</p>
                <div className="mt-3 border-t border-[#E8E4DE] pt-4">
                  <PriceRangeFilter
                    key={`${priceMinFilter}-${priceMaxFilter}`}
                    bounds={priceBounds}
                    value={{ min: priceMinFilter, max: priceMaxFilter }}
                    basePath="/catalogue"
                    preserveParams={{
                      q: search,
                      category: categoryFilter,
                      brand: brandFilter,
                      sort: sort !== 'name' ? sort : '',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-[#E8E4DE] bg-white pt-4">
              <Link
                href="/catalogue"
                className={`inline-flex min-h-10 w-full items-center text-[12px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  hasFilters
                    ? 'text-[#806A50] hover:text-[#9C8567]'
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
              {brandFilter ? <input type="hidden" name="brand" value={brandFilter} /> : null}
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
                  className="bg-[#806A50] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
                >
                  Apply
                </button>
              </div>
              {sort && sort !== 'name' ? <input type="hidden" name="sort" value={sort} className="lg:hidden" /> : null}
              <button
                type="submit"
                className="bg-[#806A50] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white lg:hidden"
              >
                Apply
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#806A50]">
                <span className="font-semibold">{filtered.length}</span>
                <span className="text-[#5C6570]"> {filtered.length === 1 ? 'product' : 'products'}</span>
                {activeCategoryName ? (
                  <span className="text-[#5C6570]"> in {activeCategoryName}</span>
                ) : null}
                {activeBrandName ? <span className="text-[#5C6570]"> · {activeBrandName}</span> : null}
                {priceIsFiltered ? (
                  <span className="text-[#5C6570]">
                    {' '}
                    · {formatCurrency(priceMinFilter)} – {formatCurrency(priceMaxFilter)}
                  </span>
                ) : null}
                {search ? <span className="text-[#5C6570]"> · “{search}”</span> : null}
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
