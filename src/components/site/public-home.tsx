import Image from 'next/image'
import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { SiteProductCard } from '@/components/site/site-product-card'
import { HeroStage } from '@/components/site/hero-stage'
import { ProductRail } from '@/components/site/product-rail'
import { Reveal } from '@/components/site/reveal'
import { formatCurrency, slugify } from '@/lib/utils'
import {
  BUDGET_BANDS,
  CATALOGUE_COLLECTIONS,
  CATALOGUE_OCCASIONS,
} from '@/lib/catalogue/collections'
import { getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import {
  curateEditProducts,
  curateFeaturedProducts,
  curateHeroProducts,
  curateMoreProducts,
  curateStoryProduct,
  curateTrendingProducts,
  homeCategoryTiles,
  pickCategorySample,
  pickCollectionSample,
  pickOccasionSample,
} from '@/lib/catalogue/curate'

const CATEGORY_LINES: Record<string, string> = {
  Drinkware: 'Bottles, tumblers and everyday presence',
  'Bags & Travel': 'Carry pieces for modern teams',
  'Tech & Electronics': 'Useful tech that earns desk space',
  'Desk & Stationery': 'Notebooks, pens and desk kits',
  Apparel: 'Wearable brand moments',
  'Hampers & Gift Sets': 'Curated boxes, ready to programme',
  'Welcome Kits': 'First-day essentials',
  'Eco-Friendly Gifts': 'Lower-impact corporate gifts',
  Wellness: 'Thoughtful wellbeing gifts',
  'Home & Lifestyle': 'Objects for life beyond the office',
  'Awards & Recognition': 'Milestones made tangible',
  Other: 'Everything else, still catalogue-ready',
  Watches: 'Timepieces with quiet authority',
}

export async function PublicHome() {
  const products = await getPublicCatalogueProducts()
  const categories = homeCategoryTiles(await getPublicCategories(), 6)
  const edit = curateEditProducts(products, 6)
  const trending = curateTrendingProducts(products, 10)
  const featured = curateFeaturedProducts(products, 8)
  const more = curateMoreProducts(products, [...featured, ...trending], 8)
  const heroProducts = curateHeroProducts(products, 5)
  const story = curateStoryProduct(products)
  const collections = CATALOGUE_COLLECTIONS.filter((collection) => products.some(collection.match)).slice(0, 6)
  const budgetCounts = BUDGET_BANDS.map((band) => ({
    ...band,
    count: products.filter((product) => {
      const price = product.price || 0
      return price >= band.min && price < band.max
    }).length,
  })).filter((band) => band.count > 0)

  const occasionVisuals = CATALOGUE_OCCASIONS.map((occasion, index) => {
    const sample = pickOccasionSample(products, index)
    return { ...occasion, sample }
  })

  return (
    <div className="bg-[#F7F4EF]">
      <HeroStage products={heroProducts} catalogueCount={products.length} />

      <section className="bg-[#F7F4EF] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#3F3A34]">Trending corporate gifts</p>
                <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">What teams are choosing.</h2>
              </div>
              <Link href="/catalogue?sort=newest" className="hidden text-[11px] uppercase tracking-[0.16em] text-[#1A3022] sm:inline">
                View all →
              </Link>
            </div>
          </Reveal>
          <div className="mt-10">
            <ProductRail products={trending} />
          </div>
        </div>
      </section>

      <section className="bg-[#F7F4EF] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#3F3A34]">Shop by category</p>
                <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">Find the right lane.</h2>
              </div>
              <Link href="/categories" className="hidden text-[11px] uppercase tracking-[0.16em] text-[#1A3022] sm:inline">
                All categories →
              </Link>
            </div>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {categories.map((category, index) => {
              const sample = pickCategorySample(products, category.id, category.name)
              const count = products.filter((product) => product.category_id === category.id).length
              return (
                <Reveal key={category.id} delay={(index % 3) * 60}>
                  <Link
                    href={`/categories/${slugify(category.name)}`}
                    className="group relative block overflow-hidden bg-[#F0EBE4]"
                  >
                    <div className="aspect-[4/5]">
                      {sample ? (
                        <ProductImage
                          src={sample.image_url}
                          alt={category.name}
                          size="md"
                          fit="cover"
                          className="h-full min-h-0 w-full"
                          imgClassName="catalogue-fill-zoom-strong transition-transform duration-700"
                        />
                      ) : null}
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#1A3022]/90 via-[#1A3022]/45 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-[#FAF7F2]">
                      <p className="font-serif text-xl leading-tight text-[#FAF7F2]">{category.name}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#FAF7F2]/85">
                        {CATEGORY_LINES[category.name] || `${count} gifts`}
                      </p>
                      <p className="mt-3 translate-x-0 text-[11px] uppercase tracking-[0.16em] text-[#FAF7F2] transition-transform duration-500 group-hover:translate-x-1">
                        Explore →
                      </p>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#1A3022] py-20 text-[#FAF7F2]">
        <div className="absolute inset-0 opacity-20">
          <Image
            src="/site/banner-brand.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#102018] via-[#1A3022]/95 to-[#1A3022]/90" />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#D6CEBE]">Premium gifting stories</p>
            <h2 className="mt-4 max-w-3xl font-serif text-4xl tracking-tight text-[#FAF7F2] sm:text-5xl">
              Gifts that represent your brand.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#F0EAE0]/85">
              From first enquiry to fulfilment — catalogue, quotation and delivery in one GIFFTER workflow.
            </p>
            <Link
              href="/catalogue"
              className="mt-8 inline-flex border border-[#EFE8DC]/40 px-6 py-3 text-[11px] uppercase tracking-[0.18em] text-[#F7F2EA] transition-colors hover:bg-[#F7F4EF]/10"
            >
              Browse the Catalogue →
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#F7F4EF] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#3F3A34]">The GIFFTER Edit</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">Curated collections.</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection, index) => {
              const sample = pickCollectionSample(products, collection.slug, collection.match)
              return (
                <Reveal key={collection.slug} delay={(index % 3) * 70}>
                  <Link
                    href={`/collections/${collection.slug}`}
                    className="group relative block min-h-[280px] overflow-hidden bg-[#F0EBE4]"
                  >
                    {sample ? (
                      <ProductImage
                        src={sample.image_url}
                        alt={collection.title}
                        size="md"
                        fit="cover"
                        className="absolute inset-0 h-full min-h-0 w-full"
                        imgClassName="catalogue-fill-zoom transition-transform duration-700"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#122018]/90 via-[#122018]/45 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6 text-[#FAF7F2]">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-[#FAF7F2]/80">{collection.kicker}</p>
                      <p className="mt-2 font-serif text-2xl text-[#FAF7F2]">{collection.title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-[#F0EAE0]/85">{collection.description}</p>
                      <p className="mt-4 text-[11px] uppercase tracking-[0.16em] transition-transform duration-500 group-hover:translate-x-1">
                        Open collection →
                      </p>
                    </div>
                  </Link>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {story ? (
        <section className="bg-[#F7F4EF] py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <div className="relative aspect-[4/5] overflow-hidden bg-[#F0EBE4]">
                <Image
                  src="/site/story-executive.webp"
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover opacity-90"
                />
                <div className="absolute inset-6 overflow-hidden border border-white/40 bg-[#F7F4EF]/95 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:inset-10">
                  <ProductImage
                    src={story.image_url}
                    alt={story.name}
                    size="md"
                    fit="cover"
                    className="h-full min-h-0 w-full"
                  />
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#3F3A34]">Featured corporate gift</p>
              <h2 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
                One gift.
                <br />
                A lasting impression.
              </h2>
              <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[#3F3A34]">{story.category_name}</p>
              <p className="mt-4 font-serif text-2xl text-[#1C1917]">{story.name}</p>
              <p className="mt-4 max-w-md text-base leading-relaxed text-[#3F3A34]">
                {story.description ||
                  'A catalogue piece selected for presence, practicality and programme-ready quoting.'}
              </p>
              <p className="mt-5 text-lg text-[#1A3022]">{formatCurrency(story.price)}</p>
              <Link
                href={`/catalogue/${story.id}`}
                className="mt-8 inline-flex bg-[#1A3022] px-7 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#F7F2EA]"
              >
                View Product
              </Link>
            </Reveal>
          </div>
        </section>
      ) : null}

      <section className="bg-[#F0EBE4] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#3F3A34]">Shop by occasion</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">Programmes that need gifts.</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {occasionVisuals.map((occasion, index) => (
              <Reveal key={occasion.slug} delay={(index % 3) * 50}>
                <Link href={occasion.href} className="group relative block overflow-hidden bg-[#F0EBE4]">
                  <div className="aspect-[5/4]">
                    {occasion.sample ? (
                      <ProductImage
                        src={occasion.sample.image_url}
                        alt={occasion.title}
                        size="md"
                        fit="cover"
                        className="h-full min-h-0 w-full"
                        imgClassName="catalogue-fill-zoom transition-transform duration-700"
                      />
                    ) : null}
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#1A3022]/90 via-[#1A3022]/45 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-[#FAF7F2]">
                    <p className="font-serif text-xl text-[#FAF7F2]">{occasion.title}</p>
                    <p className="mt-1 text-xs text-[#F0EAE0]/85">{occasion.line}</p>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.16em]">Browse →</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {budgetCounts.length > 0 && (
        <section className="bg-[#F7F4EF] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#3F3A34]">Gifts by budget</p>
              <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">Start where the brief starts.</h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {budgetCounts.map((band) => (
                <Link
                  key={band.id}
                  href={`/catalogue?budget=${band.id}`}
                  className="border border-[#B7AD9F] bg-[#D8D0C4] px-5 py-7 transition-colors hover:border-[#1A3022] hover:bg-[#F7F4EF]"
                >
                  <p className="font-serif text-xl text-[#1C1917]">{band.label}</p>
                  <p className="mt-3 text-xs text-[#3F3A34]">
                    {band.count} {band.count === 1 ? 'gift' : 'gifts'}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0">
          <Image
            src="/site/banner-milestones.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#122018]/82" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5 text-center text-[#F7F2EA] sm:px-8">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#D6CEBE]">From first day to big milestones</p>
            <h2 className="mx-auto mt-4 max-w-3xl font-serif text-4xl tracking-tight text-[#FAF7F2] sm:text-5xl">
              Built for teams. Designed for people.
            </h2>
            <Link
              href="/collections/new-joiner-essentials"
              className="mt-8 inline-flex bg-[#F7F4EF] px-7 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#1A3022]"
            >
              Explore Welcome Kits
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#F7F4EF] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#3F3A34]">Featured corporate gifts</p>
                <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">From the catalogue.</h2>
              </div>
              <Link href="/catalogue" className="text-[11px] uppercase tracking-[0.16em] text-[#1A3022]">
                Full catalogue →
              </Link>
            </div>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
            {featured.map((product) => (
              <SiteProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {more.length > 0 && (
        <section className="bg-[#F7F4EF] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#3F3A34]">Keep browsing</p>
              <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">More from the collection.</h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
              {more.map((product) => (
                <SiteProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-[#F3EFE8] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#3F3A34]">Why GIFFTER</p>
            <h2 className="mt-2 max-w-xl font-serif text-3xl tracking-tight sm:text-4xl">
              From enquiry to fulfilment, in one place.
            </h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Curated corporate gifts', body: 'A live catalogue organised by category and ready to quote.' },
              { title: 'Custom branding', body: 'Mockups and personalisation handled inside the GIFFTER workflow.' },
              { title: 'Bulk gifting', body: 'Minimum order quantities for programme-scale orders — not single-item checkout.' },
              { title: 'End-to-end fulfilment', body: 'Quotations, orders, courier partners and invoicing in the same system.' },
            ].map((item) => (
              <div key={item.title} className="border-t border-[#1A3022]/15 pt-5">
                <p className="font-serif text-xl">{item.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-[#3F3A34]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-24 text-center text-[#F7F2EA]">
        <div className="absolute inset-0">
          <Image src="/site/cta-dark.webp" alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[#0E1A13]/86" />
        </div>
        <div className="relative mx-auto max-w-3xl px-5 sm:px-8">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#D6CEBE]">Request a quote</p>
            <h2 className="mt-4 font-serif text-4xl tracking-tight text-[#FAF7F2] sm:text-5xl">
              Ready to create your next gifting programme?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#F0EAE0]/85">
              Tell us who you are gifting, and we will prepare the quotation.
            </p>
            <Link
              href="/request-quote"
              className="mt-10 inline-flex bg-[#F7F4EF] px-8 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#1A3022]"
            >
              Request a Quote
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
