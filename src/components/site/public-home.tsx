import Link from 'next/link'
import { BrandName } from '@/components/brand/brand-name'
import { ProductImage } from '@/components/ui/product-image'
import { SiteProductCard } from '@/components/site/site-product-card'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { SlimHero } from '@/components/site/slim-hero'
import { ProductRail } from '@/components/site/product-rail'
import { Reveal } from '@/components/site/reveal'
import { slugify } from '@/lib/utils'
import {
  BUDGET_BANDS,
  CATALOGUE_COLLECTIONS,
  CATALOGUE_OCCASIONS,
} from '@/lib/catalogue/collections'
import { getPublicCatalogueProducts, getPublicCategories, getPublicBrands } from '@/lib/catalogue/products'
import { curatePublicHome, homeCategoryTiles } from '@/lib/catalogue/curate'

const ARROW = '\u2192'

const TILE_LABEL: Record<string, string> = {
  Drinkware: 'Drinkware & Mugs',
  'Desk & Stationery': 'Diaries & Notebooks',
}

const CATEGORY_LINES: Record<string, string> = {
  Drinkware: 'Bottles, tumblers and everyday presence',
  'Bags & Travel': 'Carry pieces for modern teams',
  'Tech & Electronics': 'Useful tech that earns desk space',
  'Desk & Stationery': 'Notebooks, pens and desk kits',
  Apparel: 'Wearable brand moments',
  'Hampers & Gift Sets': 'Curated boxes, ready to programme',
}

export async function PublicHome() {
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
  const liveCategories = await getPublicCategories()
  const categories = homeCategoryTiles(
    preview
      ? [
          { id: 'c1', name: 'Welcome Kits' },
          { id: 'c2', name: 'Drinkware' },
          { id: 'c3', name: 'Bottles' },
          { id: 'c4', name: 'Desk & Stationery' },
          { id: 'c5', name: 'Apparel' },
          { id: 'c6', name: 'Watches' },
        ]
      : liveCategories,
    6,
  )
  const collections = CATALOGUE_COLLECTIONS.filter((collection) => products.some(collection.match)).slice(0, 6)
  const {
    categorySamples,
    collectionSamples,
    occasionSamples,
    trending,
    featured,
    more,
  } = curatePublicHome(products, categories, collections, CATALOGUE_OCCASIONS)

  const budgetCounts = BUDGET_BANDS.map((band) => ({
    ...band,
    count: products.filter((product) => {
      const price = product.price || 0
      return price >= band.min && price < band.max
    }).length,
  })).filter((band) => band.count > 0)

  const occasionVisuals = CATALOGUE_OCCASIONS.map((occasion) => ({
    ...occasion,
    sample: occasionSamples.get(occasion.slug) || null,
  }))

  return (
    <div className="bg-white">
      <SlimHero />

      {/* Top Trending — Bombay Store pattern */}
      <section className="bg-white py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="store-eyebrow">Top trending</p>
                <h2 className="store-section-title mt-2">Products teams love.</h2>
              </div>
              <Link href="/catalogue?sort=newest" className="store-link shrink-0">
                View all {ARROW}
              </Link>
            </div>
          </Reveal>
          <div className="mt-8">
            <ProductRail products={trending} />
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="bg-[#F6F4F1] py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="store-eyebrow">Featured categories</p>
                <h2 className="store-section-title mt-2">Shop by category.</h2>
              </div>
              <Link href="/categories" className="store-link shrink-0">
                All categories {ARROW}
              </Link>
            </div>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:gap-5">
            {categories.map((category, index) => {
              const sample = categorySamples.get(category.id) || null
              return (
                <Reveal key={category.id} delay={(index % 3) * 50}>
                  <Link
                    href={`/categories/${slugify(category.name)}`}
                    className="group block overflow-hidden rounded-md bg-white shadow-[0_1px_3px_rgba(27,36,48,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgba(27,36,48,0.08)]"
                  >
                    <div className="aspect-square catalogue-studio-field">
                      {sample ? (
                        <ProductImage
                          src={sample.image_url}
                          alt={category.name}
                          size="md"
                          fit="contain"
                          fadeEdges
                          className="h-full w-full bg-transparent"
                          imgClassName="catalogue-product-img scale-[1.04] transition-transform duration-500 group-hover:scale-[1.06]"
                        />
                      ) : null}
                    </div>
                    <div className="border-t border-[#E8E4DE] px-3 py-3 text-center sm:px-4 sm:py-4">
                      <p className="font-serif text-lg text-[#1B2430] sm:text-xl">{TILE_LABEL[category.name] || category.name}</p>
                      {CATEGORY_LINES[category.name] ? (
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#5C6570]">
                          {CATEGORY_LINES[category.name]}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {brands.length ? (
        <section className="border-y border-[#E8E4DE] bg-white py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#806A50]">Brands</p>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/catalogue?brand=${brand.id}`}
                  className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md border border-[#E8E4DE] bg-[#F6F4F1] px-2 text-center text-xs font-medium text-[#1B2430]"
                >
                  {brand.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo_url} alt={brand.name} className="max-h-10 w-auto object-contain" />
                  ) : (
                    brand.name
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Collections */}
      <section className="bg-white py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="store-eyebrow">Collections</p>
                <h2 className="store-section-title mt-2">Curated for every brief.</h2>
              </div>
              <Link href="/collections" className="store-link shrink-0">
                View all {ARROW}
              </Link>
            </div>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection, index) => {
              const sample = collectionSamples.get(collection.slug) || null
              return (
                <Reveal key={collection.slug} delay={(index % 3) * 50}>
                  <Link
                    href={`/collections/${collection.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-md border border-[#E8E4DE] bg-white transition-shadow hover:shadow-[0_8px_24px_rgba(27,36,48,0.08)]"
                  >
                    <div className="relative aspect-[5/3] catalogue-studio-field">
                      {sample ? (
                        <ProductImage
                          src={sample.image_url}
                          alt={collection.title}
                          size="md"
                          fit="contain"
                          fadeEdges
                          className="absolute inset-0 h-full w-full bg-transparent"
                          imgClassName="catalogue-product-img scale-[1.05]"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col px-5 py-5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[#5C6570]">{collection.kicker}</p>
                      <p className="mt-2 font-serif text-2xl text-[#1B2430]">{collection.title}</p>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-[#5C6570]">{collection.description}</p>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#806A50]">
                        Open collection {ARROW}
                      </p>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* Shop by Occasion */}
      <section className="bg-white py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="store-eyebrow">Shop by occasion</p>
            <h2 className="store-section-title mt-2">Hand-picked for every gifting need.</h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {occasionVisuals.map((occasion, index) => (
              <Reveal key={occasion.slug} delay={(index % 3) * 40}>
                <Link
                  href={occasion.href}
                  className="group flex gap-4 overflow-hidden rounded-md border border-[#E8E4DE] bg-white p-3 transition-shadow hover:shadow-[0_8px_24px_rgba(27,36,48,0.08)] sm:p-4"
                >
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-md catalogue-studio-field sm:h-28 sm:w-28">
                    {occasion.sample ? (
                      <ProductImage
                        src={occasion.sample.image_url}
                        alt={occasion.title}
                        size="sm"
                        fit="contain"
                        fadeEdges
                        className="h-full w-full bg-transparent"
                        imgClassName="catalogue-product-img"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <p className="font-serif text-xl text-[#1B2430]">{occasion.title}</p>
                    <p className="mt-1 text-sm text-[#5C6570]">{occasion.line}</p>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#806A50]">
                      Browse {ARROW}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Shop by price */}
      {budgetCounts.length > 0 ? (
        <section className="bg-[#F6F4F1] py-10 sm:py-14 lg:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <p className="store-eyebrow">Shop by price</p>
              <h2 className="store-section-title mt-2">Start where the brief starts.</h2>
            </Reveal>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {budgetCounts.map((band) => (
                <Link
                  key={band.id}
                  href={`/catalogue?budget=${encodeURIComponent(band.id)}`}
                  className="rounded-md border border-[#E8E4DE] bg-white px-4 py-6 text-center transition-shadow hover:shadow-[0_8px_20px_rgba(27,36,48,0.07)]"
                >
                  <p className="font-serif text-xl text-[#1B2430]">{band.label}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* From the catalogue grid */}
      <section className="bg-white py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="store-eyebrow">From the catalogue</p>
                <h2 className="store-section-title mt-2">Featured gifts.</h2>
              </div>
              <Link href="/catalogue" className="store-link">
                Full catalogue {ARROW}
              </Link>
            </div>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {featured.map((product) => (
              <SiteProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {more.length > 0 ? (
        <section className="bg-[#F6F4F1] py-10 sm:py-14 lg:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="store-eyebrow">Keep browsing</p>
                  <h2 className="store-section-title mt-2">More from the collection.</h2>
                </div>
                <Link href="/catalogue" className="store-link shrink-0">
                  View all {ARROW}
                </Link>
              </div>
            </Reveal>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
              {more.map((product) => (
                <SiteProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Trust / why */}
      <section className="bg-white py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="store-eyebrow">
              Why <BrandName />
            </p>
            <h2 className="store-section-title mt-2 max-w-xl">From enquiry to fulfilment, in one place.</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Curated corporate gifts',
                body: 'A live catalogue organised by category and ready to quote.',
              },
              {
                title: 'Custom branding',
                body: (
                  <>
                    Mockups and personalisation handled inside the <BrandName /> workflow.
                  </>
                ),
              },
              {
                title: 'Bulk gifting',
                body: 'Minimum order quantities for programme-scale orders — not single-item checkout.',
              },
              {
                title: 'End-to-end fulfilment',
                body: 'Quotations, orders, courier partners and invoicing in the same system.',
              },
            ].map((item) => (
              <div key={item.title} className="border-t border-[#806A50]/15 pt-5">
                <p className="font-serif text-xl">{item.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-[#5C6570]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {preview ? (
        <section className="bg-white py-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
            <p className="text-sm text-[#5C6570]">In stock</p>
            <AddToCartButton
              maxQuantity={1}
              label="Buy 1 sample"
              product={{ id: '33333333-3333-4333-8333-333333333333', sku: 'BTL-1', name: 'Steel bottle', price: 450, image_url: '/site/home-festive-cane.webp' }}
              className="inline-flex bg-[#806A50] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
            />
            <a href="/request-quote" className="inline-flex border border-[#E5DFD5] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#806A50]">
              Request a Quote
            </a>
          </div>
        </section>
      ) : null}
      <section className="bg-[#241C12] py-8 text-center text-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8E4DE]">Request a quote</p>
            <h2 className="mt-1 font-serif text-2xl">Ready for your next gifting programme?</h2>
          </div>
          <Link href="/request-quote" className="inline-flex bg-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#241C12]">
            Request a Quote
          </Link>
        </div>
      </section>
    </div>
  )
}
