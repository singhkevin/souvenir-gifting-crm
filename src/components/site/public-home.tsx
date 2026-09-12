import Image from 'next/image'
import Link from 'next/link'
import { BrandName } from '@/components/brand/brand-name'
import { ProductImage } from '@/components/ui/product-image'
import { SiteProductCard } from '@/components/site/site-product-card'
import { HeroStage } from '@/components/site/hero-stage'
import { ProductRail } from '@/components/site/product-rail'
import { Reveal } from '@/components/site/reveal'
import { slugify } from '@/lib/utils'
import {
  BUDGET_BANDS,
  CATALOGUE_COLLECTIONS,
  CATALOGUE_OCCASIONS,
} from '@/lib/catalogue/collections'
import { getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import { curatePublicHome, homeCategoryTiles } from '@/lib/catalogue/curate'

const ARROW = '\u2192'

const CATEGORY_LINES: Record<string, string> = {
  Drinkware: 'Bottles, tumblers and everyday presence',
  'Bags & Travel': 'Carry pieces for modern teams',
  'Tech & Electronics': 'Useful tech that earns desk space',
  'Desk & Stationery': 'Notebooks, pens and desk kits',
  Apparel: 'Wearable brand moments',
  'Hampers & Gift Sets': 'Curated boxes, ready to programme',
}

export async function PublicHome() {
  const products = await getPublicCatalogueProducts()
  const categories = homeCategoryTiles(await getPublicCategories(), 6)
  const collections = CATALOGUE_COLLECTIONS.filter((collection) => products.some(collection.match)).slice(0, 6)
  const {
    heroProducts,
    categorySamples,
    collectionSamples,
    occasionSamples,
    trending,
    featured,
    more,
  } = curatePublicHome(products, categories, collections, CATALOGUE_OCCASIONS)

  const rankedHero = [...products]
    .filter((product) => Boolean(product.image_url?.trim()))
    .sort((a, b) => {
      const rank = (url: string) => {
        if (/square-/i.test(url)) return 3
        if (/\/site\/home-/i.test(url)) return 2
        if (/studio-pack-/i.test(url)) return 1
        return 0
      }
      return rank(b.image_url || '') - rank(a.image_url || '')
    })
  const heroOffset = rankedHero.length > 12 ? 10 : 0
  const heroSlideshow = rankedHero.slice(heroOffset).concat(rankedHero.slice(0, heroOffset))

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
      <HeroStage products={heroSlideshow.length ? heroSlideshow : heroProducts} />

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
                      <p className="font-serif text-lg text-[#1B2430] sm:text-xl">{category.name}</p>
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

      {/* Brand / legacy banner */}
      <section className="relative overflow-hidden py-20 text-white">
        <div className="absolute inset-0">
          <Image src="/site/banner-brand.webp" alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[#1A3022]/88" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="mx-auto max-w-3xl font-serif text-3xl tracking-tight sm:text-4xl lg:text-5xl">
              Gifts that represent your brand.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80">
              From first enquiry to fulfilment — catalogue, quotation and delivery in one <BrandName /> workflow.
            </p>
            <Link
              href="/catalogue"
              className="mt-8 inline-flex border border-white/40 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-white/10"
            >
              Browse the Catalogue {ARROW}
            </Link>
          </Reveal>
        </div>
      </section>

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
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1A3022]">
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
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1A3022]">
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
              <div key={item.title} className="border-t border-[#1A3022]/15 pt-5">
                <p className="font-serif text-xl">{item.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-[#5C6570]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote CTA */}
      <section className="relative overflow-hidden py-14 text-center text-white sm:py-20">
        <div className="absolute inset-0">
          <Image src="/site/cta-dark.webp" alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[#0E1A13]/86" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">Request a quote</p>
            <h2 className="mt-4 font-serif text-3xl tracking-tight sm:text-4xl lg:text-5xl">
              Ready for your next gifting programme?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80">
              Tell us who you are gifting, and we will prepare the quotation.
            </p>
            <Link
              href="/request-quote"
              className="mt-8 inline-flex bg-white px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1A3022]"
            >
              Request a Quote
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
