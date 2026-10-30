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
import { channelCataloguePath } from '@/lib/business/portal-paths'
import { STORE_OCCASIONS } from '@/lib/catalogue/storefront'
import type { PublicProduct } from '@/lib/catalogue/products'

type Brand = { id: string; name: string; logo_url?: string | null }
type Category = { id: string; name: string }

const isOtherCategory = (category: Category) => /^other$/i.test(category.name.trim())

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
  channel = 'retail',
  embedded = false,
  hiddenPriceLabel,
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
  channel?: 'retail' | 'business'
  /** Rendered inside a page section that already supplies the band and padding. */
  embedded?: boolean
  hiddenPriceLabel?: string | null
}) {
  const priced = products.map((product) => ({ ...product, price: priceOf(product) }))
  const bounds = priceBoundsOf(priced)
  const filtered = applyCatalogueFilters(priced, filters, bounds)
  const window = resolvedPriceWindow(filters, bounds)
  const active = catalogueFiltersActive(filters, bounds)
  const visible = !active && limit ? filtered.slice(0, limit) : filtered
  const href = (patch: Parameters<typeof catalogueHref>[3] = {}) => catalogueHref(basePath, filters, bounds, patch)
  const linkClass = (on: boolean) =>
    `flex items-center justify-between gap-3 border-l-2 py-1.5 pl-3 sv2-body-sm transition-colors ${
      on ? 'border-[#9E4300] font-semibold text-[#1C1C18]' : 'border-transparent text-[#4A4640] hover:text-[#1C1C18]'
    }`

  const brandHref = (brand: Brand) => (brandMode === 'page' ? brandPath(brand, brands) : href({ brand: brand.id }))
  // Uncategorised products sit at the end of the list under a friendlier label.
  const orderedCategories = [...categories].sort(
    (a, b) => Number(isOtherCategory(a)) - Number(isOtherCategory(b)),
  )
  const categoryLabel = (category: Category) => (isOtherCategory(category) ? 'More gifts' : category.name)

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <p className="sv2-label text-[#1C1C18]">Category</p>
        <nav className="mt-2 border-t border-[#CCC5BD] pt-2 space-y-0.5">
          <Link href={href({ category: '' })} className={linkClass(!filters.category)}>
            All gifts
          </Link>
          {orderedCategories.map((item) => (
            <Link key={item.id} href={href({ category: item.id })} className={linkClass(filters.category === item.id)}>
              <span className="truncate">{categoryLabel(item)}</span>
            </Link>
          ))}
        </nav>
      </div>

      {brands.length ? (
        <div>
          <p className="sv2-label text-[#1C1C18]">Brand</p>
          <nav className="mt-2 border-t border-[#CCC5BD] pt-2 space-y-0.5">
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

      {hiddenPriceLabel ? null : (
      <div>
        <p className="sv2-label text-[#1C1C18]">Price</p>
        <nav className="mt-2 border-t border-[#CCC5BD] pt-2 space-y-0.5">
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
      )}

      <div>
        <p className="sv2-label text-[#1C1C18]">Occasion</p>
        <nav className="mt-2 border-t border-[#CCC5BD] pt-2 space-y-0.5">
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
        <div className="pt-2">
          <Link href={basePath} className="sv2-label text-[11px] text-[#9E4300] hover:underline">
            Clear all filters
          </Link>
        </div>
      ) : null}
    </div>
  )

  const chipClass = (on: boolean) =>
    `shrink-0 snap-start border px-3.5 py-2 sv2-body-sm whitespace-nowrap transition-colors ${
      on ? 'border-[#9E4300] bg-[#9E4300] text-white' : 'border-[#CCC5BD] bg-[#FCF9F2] text-[#4A4640] hover:border-[#9E4300]'
    }`

  return (
    <section
      id="catalog"
      className={embedded ? 'scroll-mt-28' : 'scroll-mt-28 border-t border-[#CCC5BD] bg-[#FCF9F2]'}
    >
      <div className={embedded ? undefined : 'mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8'}>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#CCC5BD] pb-4">
          <div>
            <h2
              className={`font-serif leading-tight tracking-tight text-[#1C1C18] font-normal ${
                embedded ? 'text-xl sm:text-2xl' : 'text-[1.75rem] sm:text-3xl lg:text-4xl'
              }`}
            >
              {heading}
            </h2>
            {intro ? (
              <p className="mt-2 max-w-xl sv2-body-sm text-[#4A4640]">{intro}</p>
            ) : null}
          </div>
          <p className="sv2-mono-sm text-[#7C766F]">
            Showing <span className="font-bold text-[#1C1C18]">{filtered.length}</span>{' '}
            {filtered.length === 1 ? 'gift' : 'gifts'}
          </p>
        </div>

        <form action={basePath} className="mb-5 flex flex-col gap-2 sm:flex-row">
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
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search gifts</span>
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search gifts, occasions, categories..."
              className="w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3.5 py-2 sv2-body-sm text-[#1C1C18] outline-none focus:border-[#9E4300] placeholder:text-[#7C766F]"
            />
          </label>
          <button
            type="submit"
            className="bg-[#000000] hover:bg-[#9E4300] px-6 py-2 sv2-label text-white tracking-wider transition-colors"
          >
            Search
          </button>
        </form>

        {/* Mobile: category chips + collapsible filters in place of the sidebar */}
        <div className="lg:hidden">
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-6 sm:px-6">
            <Link href={href({ category: '' })} className={chipClass(!filters.category)}>
              All gifts
            </Link>
            {orderedCategories.map((item) => (
              <Link key={item.id} href={href({ category: item.id })} className={chipClass(filters.category === item.id)}>
                {categoryLabel(item)}
              </Link>
            ))}
          </div>
          <details className="mt-3 border border-[#CCC5BD] bg-[#F6F3EC]">
            <summary className="cursor-pointer px-4 py-2.5 sv2-label text-[11px] text-[#1C1C18]">
              Filters
            </summary>
            <div className="border-t border-[#CCC5BD] bg-[#FCF9F2] p-4">{filterPanel}</div>
          </details>
        </div>

        <div className="mt-6 grid gap-8 lg:mt-0 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden border-r border-[#CCC5BD] pr-6 lg:block lg:sticky lg:top-28 lg:self-start">
            {filterPanel}
          </aside>

          <div className="min-w-0">
            {visible.length === 0 ? (
              <p className="py-16 text-center sv2-body-md text-[#4A4640]">No gifts match these filters.</p>
            ) : (
              <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
                {visible.map((product) => (
                  <StitchProductCard
                    key={product.id}
                    product={product}
                    price={product.price}
                    showSample={showSample}
                    caption={captionFor?.(product)}
                    tone={tone}
                    channel={channel}
                    hiddenPriceLabel={hiddenPriceLabel}
                  />
                ))}
              </div>
            )}
            {!active && limit && filtered.length > visible.length ? (
              <div className="mt-8 text-center">
                <Link
                  href={channelCataloguePath(channel)}
                  className="sv2-label text-[12px] text-[#9E4300] hover:underline"
                >
                  View all {filtered.length} products &rarr;
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
