import Link from 'next/link'
import { headers } from 'next/headers'
import { Gift, MapPinned, PackageSearch, PenLine, Truck } from 'lucide-react'
import { BusinessPromptModal } from '@/components/site/business-prompt-modal'
import { sessionHintFromHeaders } from '@/lib/auth/session-cookie'
import { ProductImage } from '@/components/ui/product-image'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { RetailHero } from '@/components/site/retail-hero'
import { BrandLogoRow, ProductSection, RetailOccasionBento } from '@/components/site/stitch-sections'
import { StorefrontCatalog } from '@/components/site/storefront-catalog'
import { readCatalogueFilters } from '@/lib/catalogue/catalogue-query'
import { HomepagePreviewBanner } from '@/components/site/homepage-preview-banner'
import { headingParts, plainHeading } from '@/lib/homepage/heading'
import { resolveHomepage } from '@/lib/homepage/resolve'
import { resolveHomepageView } from '@/lib/homepage/view'
import type { PackagingContent, PackagingIcon } from '@/lib/homepage/types'
import { getPublicBrands, getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import type { PublicProduct } from '@/lib/catalogue/products'

function storePrice(product: PublicProduct) {
  return product.price
}

const PACKAGING_ICONS: Record<PackagingIcon, typeof Gift> = {
  gift: Gift,
  pen: PenLine,
  truck: Truck,
  map: MapPinned,
  search: PackageSearch,
}

/** Tailwind needs literal class names. */
const RAIL_COLUMNS: Record<4 | 5 | 6, string> = {
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

function PackagingSection({
  content,
  photos,
}: {
  content: PackagingContent
  photos: { key: string; src: string; alt: string }[]
}) {
  return (
    <section className="border-b border-[#CCC5BD] bg-[#F6F3EC] py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-[#CCC5BD] pb-4">
          <span aria-hidden="true" className="mb-3 block h-0.5 w-10 bg-[#9E4300]" />
          {content.eyebrow ? (
            <span className="font-sans text-xs uppercase tracking-wider font-semibold text-[#9E4300] block mb-1">{content.eyebrow}</span>
          ) : null}
          <h2 className="font-serif sv2-headline-md font-normal text-[#1C1C18]">
            {headingParts(content.heading).map((part, index) =>
              part.accent ? (
                <span key={index} className="italic text-[#9E4300]">
                  {part.text}
                </span>
              ) : (
                part.text
              ),
            )}
          </h2>
          {content.subtext ? <p className="mt-2 max-w-xl sv2-body-sm text-[#4A4640]">{content.subtext}</p> : null}
        </div>
        {photos.length === 2 ? (
          <div className="mb-6 grid grid-cols-2 gap-px border border-[#CCC5BD] bg-[#CCC5BD]">
            {photos.map((photo) => (
              <div key={photo.key} className="relative aspect-[16/9] overflow-hidden bg-[#FCF9F2]">
                <ProductImage src={photo.src} alt={photo.alt} fit="cover" className="absolute inset-0 h-full w-full bg-transparent" />
              </div>
            ))}
          </div>
        ) : null}
        {content.tiles.length ? (
          <div className={`grid grid-cols-1 gap-px border border-[#CCC5BD] bg-[#CCC5BD] sm:grid-cols-2 ${TILE_COLUMNS[content.tiles.length] || 'lg:grid-cols-5'}`}>
            {content.tiles.map((tile, index) => {
              const Icon = PACKAGING_ICONS[tile.icon] || Gift
              const lead = index === 0
              return (
                <div
                  key={tile.title}
                  className={`flex flex-col gap-3 p-6 ${lead ? 'bg-[#1C1B1A] text-[#FCF9F2]' : 'bg-[#FCF9F2] text-[#1C1C18]'}`}
                >
                  <Icon size={22} strokeWidth={1.5} aria-hidden="true" className={lead ? 'text-[#FFB690]' : 'text-[#9E4300]'} />
                  <h3 className={`font-serif text-lg font-normal leading-snug ${lead ? 'text-[#FCF9F2]' : 'text-[#1C1C18]'}`}>
                    {tile.title}
                  </h3>
                  <p className={`sv2-body-sm ${lead ? 'text-[#CCC5BD]' : 'text-[#4A4640]'}`}>{tile.description}</p>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}

const TILE_COLUMNS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
}

export async function PublicHome({
  searchParams,
  basePath = '/home',
}: {
  searchParams?: Record<string, string | string[] | undefined>
  basePath?: string
}) {
  const filters = readCatalogueFilters(searchParams)
  const headerStore = await headers()
  const signedIn = sessionHintFromHeaders((name) => headerStore.get(name))
  const loaded = await getPublicCatalogueProducts()
  const preview = process.env.STOREFRONT_UI_PREVIEW === '1' && loaded.length === 0
  const products = loaded
  const loadedBrands = await getPublicBrands()
  const brands = preview
    ? [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Souvenir', logo_url: '/logo.png' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Field', logo_url: null },
      ]
    : loadedBrands
  const categories = await getPublicCategories()

  const view = await resolveHomepageView(searchParams)
  const resolved = resolveHomepage(view.config, view.collections, products, {
    date: view.date,
    includeDraftCollections: view.preview,
  })

  return (
    <div className="bg-[#FCF9F2] text-[#1C1C18]">
      {signedIn ? null : <BusinessPromptModal />}
      {view.preview ? <HomepagePreviewBanner date={view.date} source={view.source} /> : null}
      {resolved.map((section) => {
        switch (section.type) {
          case 'hero':
            return (
              <RetailHero
                key={section.key}
                content={section.content}
                slides={section.slides.map((slide) =>
                  slide.map((product) => ({ id: product.id, name: product.name, image_url: product.image_url })),
                )}
              />
            )
          case 'occasion_grid':
            return (
              <RetailOccasionBento
                key={section.key}
                products={products}
                priceOf={storePrice}
                content={section.content}
                cards={section.cards}
              />
            )
          case 'product_rail':
            return (
              <ProductSection
                key={section.key}
                eyebrow={section.content.eyebrow}
                title={section.content.heading}
                actionHref={section.content.ctaHref}
                action={section.content.ctaLabel}
                products={section.products}
                priceOf={storePrice}
                dark={section.content.dark}
                columns={RAIL_COLUMNS[section.content.columns]}
                tone="retail"
              />
            )
          case 'brand_row':
            return (
              <BrandLogoRow
                key={section.key}
                brands={brands}
                eyebrow={section.content.eyebrow}
                title={section.content.heading}
                subtext={section.content.subtext || ''}
                actionHref={section.content.ctaHref}
                action={section.content.ctaLabel}
                tone="retail"
              />
            )
          case 'packaging':
            return <PackagingSection key={section.key} content={section.content} photos={section.photos} />
          case 'catalogue_grid':
            return (
              <StorefrontCatalog
                key={section.key}
                products={products}
                categories={categories}
                brands={brands}
                filters={filters}
                basePath={basePath}
                heading={plainHeading(section.content.heading)}
                intro={section.content.subtext || ''}
                priceOf={storePrice}
                limit={section.content.itemCount}
                tone="retail"
              />
            )
        }
      })}

      {preview ? (
        <section className="bg-[#FCF9F2] py-8 border-t border-[#CCC5BD]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
            <p className="sv2-body-sm text-[#4A4640]">In stock</p>
            <AddToCartButton
              maxQuantity={1}
              label="Buy 1 sample"
              product={{ id: '33333333-3333-4333-8333-333333333333', sku: 'BTL-1', name: 'Steel bottle', price: 450, image_url: '/site/home-festive-cane.webp' }}
              className="inline-flex bg-[#000000] px-5 py-2.5 sv2-label text-white uppercase tracking-wider"
            />
            <Link href="/request-quote" className="inline-flex border border-[#CCC5BD] px-5 py-2.5 sv2-label text-[#1C1C18] uppercase tracking-wider hover:border-[#000000]">
              Request a Quote
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  )
}
