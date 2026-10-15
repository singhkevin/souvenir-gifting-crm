import Link from 'next/link'
import { StoreSectionHeading } from '@/components/site/store-ui'
import { StitchProductCard } from '@/components/site/stitch-product-card'
import { BUDGET_BANDS } from '@/lib/catalogue/collections'
import {
  applyCatalogueFilters,
  catalogueFiltersActive,
  catalogueHref,
  priceBoundsOf,
  resolvedPriceWindow,
  type CatalogueFilters,
} from '@/lib/catalogue/catalogue-query'
import { brandPath } from '@/lib/catalogue/store-nav'
import { STORE_OCCASIONS } from '@/lib/catalogue/storefront'
import type { PublicProduct } from '@/lib/catalogue/products'

type Brand = { id: string; name: string; logo_url?: string | null }
type Category = { id: string; name: string }

export function StorefrontCatalog({
  products,
  categories,
  brands,
  filters,
  basePath,
  heading,
  intro,
  priceOf,
  showSample = true,
  captionFor,
  limit,
  brandMode = 'filter',
  tone = 'default',
}: {
  products: PublicProduct[]
  categories: Category[]
  brands: Brand[]
  filters: CatalogueFilters
  basePath: string
  heading: string
  intro?: string
  priceOf: (product: PublicProduct) => number | null
  showSample?: boolean
  captionFor?: (product: PublicProduct) => string
  limit?: number
  brandMode?: 'filter' | 'page'
  tone?: 'default' | 'retail'
}) {
  const priced = products.map((product) => ({ ...product, price: priceOf(product) }))
  const bounds = priceBoundsOf(priced)
  const filtered = applyCatalogueFilters(priced, filters, bounds)
  const window = resolvedPriceWindow(filters, bounds)
  const active = catalogueFiltersActive(filters, bounds)
  const visible = !active && limit ? filtered.slice(0, limit) : filtered
  const href = (patch: Parameters<typeof catalogueHref>[3] = {}) => catalogueHref(basePath, filters, bounds, patch)
  const linkClass = (on: boolean) =>
    `flex items-center justify-between gap-3 border-l-2 py-1.5 pl-3 text-sm ${
      on ? 'border-[#715a3e] font-semibold text-[#22180b]' : 'border-transparent text-[#4d453e] hover:text-[#22180b]'
    }`

  const brandHref = (brand: Brand) => (brandMode === 'page' ? brandPath(brand, brands) : href({ brand: brand.id }))

  return (
    <section id="catalog" className="scroll-mt-28 border-t border-[#eadfd4] bg-[#fff8f4]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <StoreSectionHeading title={heading} />
        <div className="-mt-4 mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            {intro ? <p className="max-w-xl text-sm leading-6 text-[#4d453e]">{intro}</p> : null}
          </div>
          <p className="text-sm text-[#715a3e]">
            <span className="font-semibold text-[#22180b]">{filtered.length}</span>{' '}
            {filtered.length === 1 ? 'product' : 'products'}
          </p>
        </div>

        <form action={basePath} className="mb-4 flex flex-col gap-2 sm:flex-row">
          {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
          {filters.brand && brandMode === 'filter' ? <input type="hidden" name="brand" value={filters.brand} /> : null}
          {filters.occasion ? <input type="hidden" name="occasion" value={filters.occasion} /> : null}
          {filters.priceMin != null && filters.priceMin > bounds.min ? (
            <input type="hidden" name="priceMin" value={filters.priceMin} />
          ) : null}
          {filters.priceMax != null && filters.priceMax < bounds.max ? (
            <input type="hidden" name="priceMax" value={filters.priceMax} />
          ) : null}
          {filters.sort !== 'name' ? <input type="hidden" name="sort" value={filters.sort} /> : null}
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Search gifts, kits, brands"
            className="min-w-0 flex-1 rounded border border-[#eadfd4] bg-white px-3 py-2 text-sm text-[#22180b] outline-none focus:border-[#715a3e]"
          />
          <button type="submit" className="rounded bg-[#382c1e] px-4 py-2 text-sm font-semibold text-white">
            Search
          </button>
        </form>

        <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#22180b]">Category</p>
              <nav className="mt-2 border-t border-[#eadfd4] pt-2">
                <Link href={href({ category: '' })} className={linkClass(!filters.category)}>
                  All gifts
                </Link>
                {categories.map((item) => (
                  <Link key={item.id} href={href({ category: item.id })} className={linkClass(filters.category === item.id)}>
                    <span className="truncate">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </div>

            {brands.length ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#22180b]">Brand</p>
                <nav className="mt-2 border-t border-[#eadfd4] pt-2">
                  <Link href={brandMode === 'page' ? '/catalogue' : href({ brand: '' })} className={linkClass(!filters.brand)}>
                    All brands
                  </Link>
                  {brands.map((item) => (
                    <Link key={item.id} href={brandHref(item)} className={linkClass(filters.brand === item.id)}>
                      <span className="truncate">{item.name}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            ) : null}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#22180b]">Price</p>
              <nav className="mt-2 border-t border-[#eadfd4] pt-2">
                <Link href={href({ priceMin: null, priceMax: null })} className={linkClass(!window.active)}>
                  Any price
                </Link>
                {BUDGET_BANDS.map((band) => {
                  const max = band.max === Infinity ? null : band.max
                  const on =
                    (band.min === 0 ? filters.priceMin == null || filters.priceMin <= bounds.min : filters.priceMin === band.min) &&
                    (max == null ? filters.priceMax == null : filters.priceMax === max) &&
                    window.active &&
                    (band.min > 0 || max != null)
                  return (
                    <Link key={band.id} href={href({ priceMin: band.min, priceMax: max })} className={linkClass(on)}>
                      {band.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#22180b]">Occasion</p>
              <nav className="mt-2 border-t border-[#eadfd4] pt-2">
                <Link href={href({ occasion: '' })} className={linkClass(!filters.occasion)}>
                  Any occasion
                </Link>
                {STORE_OCCASIONS.map((item) => (
                  <Link key={item.id} href={href({ occasion: item.id })} className={linkClass(filters.occasion === item.id)}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            {active ? (
              <Link href={basePath} className="inline-flex text-xs font-bold uppercase tracking-[0.14em] text-[#715a3e]">
                Clear filters
              </Link>
            ) : null}
          </aside>

          <div>
            {visible.length === 0 ? (
              <p className="py-16 text-center text-sm text-[#4d453e]">No gifts match these filters.</p>
            ) : (
              <div className={tone === 'retail' ? 'grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4' : 'grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4'}>
                {visible.map((product) => (
                  <StitchProductCard
                    key={product.id}
                    product={product}
                    price={product.price}
                    showSample={showSample}
                    caption={captionFor?.(product)}
                    tone={tone}
                  />
                ))}
              </div>
            )}
            {!active && limit && filtered.length > visible.length ? (
              <div className="mt-6 text-center">
                <Link href="/catalogue" className="text-sm font-semibold text-[#715a3e] hover:text-[#22180b]">
                  View all {filtered.length} products
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
