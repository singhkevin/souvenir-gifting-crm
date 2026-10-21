import Link from 'next/link'
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
      on ? 'border-saffron font-semibold text-ink' : 'border-transparent text-ink-secondary hover:text-ink'
    }`

  const brandHref = (brand: Brand) => (brandMode === 'page' ? brandPath(brand, brands) : href({ brand: brand.id }))

  return (
    <section id="catalog" className="scroll-mt-28 border-t border-cream-border bg-cream">
      <div className={tone === 'retail' ? 'store-container py-12 sm:py-16 lg:py-20' : 'store-container py-8'}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={tone === 'retail' ? 'store-section-title' : 'font-serif text-[26px] leading-8 text-ink sm:text-[28px] sm:leading-9'}>{heading}</h2>
            {intro ? (
              <p className={tone === 'retail' ? 'mt-2 max-w-xl text-sm leading-6 text-ink-secondary' : 'mt-1 max-w-xl text-sm text-ink-secondary'}>{intro}</p>
            ) : null}
          </div>
          <p className="font-mono text-sm text-gold-deep">
            <span className="font-semibold text-ink">{filtered.length}</span>{' '}
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
          <label htmlFor="catalog-search" className="sr-only">Search gifts</label>
          <input
            id="catalog-search"
            name="q"
            defaultValue={filters.q}
            placeholder="Search gifts, kits, brands"
            className="h-11 min-w-0 flex-1 rounded border border-ink-tertiary bg-cream-card px-3 text-[15px] text-ink outline-none"
          />
          <button type="submit" className="min-h-11 rounded bg-saffron px-4 text-sm font-bold text-charcoal hover:bg-saffron-hover">
            Search
          </button>
        </form>

        <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div>
              <p className="store-eyebrow">Category</p>
              <nav className="mt-2 border-t border-cream-border pt-2">
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
                <p className="store-eyebrow">Brand</p>
                <nav className="mt-2 border-t border-cream-border pt-2">
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
              <p className="store-eyebrow">Price</p>
              <nav className="mt-2 border-t border-cream-border pt-2">
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
              <p className="store-eyebrow">Occasion</p>
              <nav className="mt-2 border-t border-cream-border pt-2">
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
              <Link href={basePath} className="inline-flex min-h-11 items-center font-mono text-xs font-medium tracking-[0.08em] text-gold-deep uppercase">
                Clear filters
              </Link>
            ) : null}
          </aside>

          <div>
            {visible.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-secondary">No gifts match these filters.</p>
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
                <Link href="/catalogue" className="text-sm font-semibold text-gold-deep hover:text-ink">
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
