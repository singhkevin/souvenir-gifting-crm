import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { StitchProductCard } from '@/components/site/stitch-product-card'
import { siteContent } from '@/config/siteContent'
import { brandPath } from '@/lib/catalogue/store-nav'
import { collectionBySlug } from '@/lib/catalogue/collections'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'
import { headingParts } from '@/lib/homepage/heading'
import type { OccasionCard as OccasionCardData, OccasionGridContent } from '@/lib/homepage/types'

type Brand = { id: string; name: string; logo_url: string | null }

type Occasion = {
  title: string
  kicker: string
  line: string
  href: string
  slug: string
  size: 'large' | 'small'
}

export const RETAIL_OCCASIONS: Occasion[] = [
  {
    title: 'Festive & Diwali Hampers',
    kicker: 'Seasonal',
    line: 'Hampers and festive boxes from the catalogue',
    href: '/collections/festival-gifting',
    slug: 'festival-gifting',
    size: 'large',
  },
  {
    title: 'Day-One Welcome Kits',
    kicker: 'HR & People',
    line: 'Onboarding sets ready to brand',
    href: '/collections/welcome-kits',
    slug: 'welcome-kits',
    size: 'large',
  },
  {
    title: 'Client & CXO Appreciation',
    kicker: 'Executive',
    line: 'Gifts for the relationships you keep',
    href: '/collections/client-appreciation',
    slug: 'client-appreciation',
    size: 'large',
  },
  {
    title: 'Onboarding Essentials',
    kicker: 'First day',
    line: 'Kits and desk pieces for new joiners',
    href: '/collections/new-joiner-essentials',
    slug: 'new-joiner-essentials',
    size: 'small',
  },
  {
    title: 'Conferences & Summits',
    kicker: 'Events',
    line: 'Drinkware, desk and tech for the room',
    href: '/collections/conference-and-events',
    slug: 'conference-and-events',
    size: 'small',
  },
  {
    title: 'Work Anniversary',
    kicker: 'Milestones',
    line: 'Recognition pieces for tenure and loyalty',
    href: '/collections/executive-edit',
    slug: 'executive-edit',
    size: 'small',
  },
]

export const BUSINESS_OCCASIONS: Occasion[] = [
  {
    title: 'Festive & Diwali Specials',
    kicker: 'Festive season',
    line: 'Seasonal hampers and festive boxes from the live catalogue.',
    href: '/collections/festival-gifting',
    slug: 'festival-gifting',
    size: 'large',
  },
  {
    title: 'Welcome & Joining Kits',
    kicker: 'HR favourite',
    line: 'Day-one kits: drinkware, notebooks and desk sets.',
    href: '/collections/welcome-kits',
    slug: 'welcome-kits',
    size: 'large',
  },
  {
    title: 'Employee Onboarding',
    kicker: 'Turnkey',
    line: 'Desk and welcome pieces for a new team.',
    href: '/collections/new-joiner-essentials',
    slug: 'new-joiner-essentials',
    size: 'small',
  },
  {
    title: 'Client & CXO Suites',
    kicker: 'Prestige',
    line: 'Higher-consideration gifts for clients.',
    href: '/collections/client-appreciation',
    slug: 'client-appreciation',
    size: 'small',
  },
  {
    title: 'Conferences & Summits',
    kicker: 'Events',
    line: 'Delegate gifts from drinkware, bags and desk.',
    href: '/collections/conference-and-events',
    slug: 'conference-and-events',
    size: 'small',
  },
  {
    title: 'Work Anniversary & Milestones',
    kicker: 'Recognition',
    line: 'Awards and keepsakes for tenure.',
    href: '/collections/executive-edit',
    slug: 'executive-edit',
    size: 'small',
  },
]

function matches(products: PublicProduct[], slug: string) {
  const collection = collectionBySlug(slug)
  if (!collection) return []
  return products.filter(collection.match)
}

function lowestPrice(items: PublicProduct[], priceOf: (product: PublicProduct) => number | null) {
  const prices = items.map(priceOf).filter((price): price is number => price != null && price > 0)
  if (!prices.length) return null
  return Math.min(...prices)
}

/** Keyword hints used to pick a representative photo for each collection tile. */
const COLLECTION_KEYWORDS: Record<string, RegExp> = {
  'festival-gifting': /hamper|gift box|festive|sweets|diya/i,
  'welcome-kits': /kit|welcome|bottle|notebook/i,
  'client-appreciation': /premium|leather|crystal|watch|award/i,
  'new-joiner-essentials': /notebook|desk|bottle|mug|kit/i,
  'conference-and-events': /bag|lanyard|badge|bottle|pen|notebook/i,
  'executive-edit': /award|plaque|trophy|crystal|watch|frame/i,
}

/** Picks up to `count` distinct pictured products, preferring names that fit the collection. */
function pickTileProducts(
  items: PublicProduct[],
  slug: string,
  usedIds: Set<string>,
  usedImages: Set<string>,
  count: number,
) {
  const pattern = COLLECTION_KEYWORDS[slug]
  const ranked = items
    .filter((product) => product.image_url && !usedIds.has(product.id) && !usedImages.has(product.image_url))
    .map((product) => ({
      product,
      score: pattern && pattern.test(`${product.name} ${product.category_name || ''}`) ? 1 : 0,
    }))
    .sort((a, b) => b.score - a.score)

  const picked: PublicProduct[] = []
  for (const { product } of ranked) {
    if (picked.length >= count) break
    const image = product.image_url as string
    if (usedImages.has(image)) continue
    usedIds.add(product.id)
    usedImages.add(image)
    picked.push(product)
  }
  return picked
}

function OccasionCard({
  occasion,
  pictures,
  from,
}: {
  occasion: Occasion
  pictures: PublicProduct[]
  from: number | null
}) {
  const [main, ...extras] = pictures

  return (
    <Link
      href={occasion.href}
      aria-label={occasion.title}
      className="group flex w-[80%] shrink-0 snap-start flex-col border border-[#CCC5BD] bg-[#FCF9F2] transition-colors hover:border-[#9E4300] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#9E4300] sm:w-[55%] lg:w-auto lg:shrink"
    >
      <div className="flex aspect-[4/3] gap-px overflow-hidden bg-[#CCC5BD]">
        <div className="relative min-w-0 flex-1 overflow-hidden bg-[#F6F3EC]">
          {main ? (
            <ProductImage
              src={main.image_url}
              alt=""
              fit="cover"
              className="absolute inset-0 h-full w-full bg-transparent"
              imgClassName="transition-transform duration-500 group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : null}
        </div>
        {extras.length ? (
          <div className="flex w-[32%] shrink-0 flex-col gap-px">
            {extras.map((item) => (
              <div key={item.id} className="relative min-h-0 flex-1 overflow-hidden bg-[#F6F3EC]">
                <ProductImage
                  src={item.image_url}
                  alt=""
                  fit="cover"
                  className="absolute inset-0 h-full w-full bg-transparent"
                  imgClassName="transition-transform duration-500 group-hover:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col border-t border-[#CCC5BD] bg-[#FCF9F2] p-4 sm:p-5">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#9E4300]">
          {occasion.kicker}
        </span>
        <h3 className="mt-1.5 font-serif text-[20px] font-normal leading-snug text-[#1C1C18] decoration-[#9E4300] underline-offset-4 group-hover:underline">
          {occasion.title}
        </h3>
        <p className="mt-1.5 sv2-body-sm text-[#4A4640]">{occasion.line}</p>
        {from != null ? (
          <p className="mt-auto pt-3 sv2-mono-sm text-[12px] font-bold text-[#1C1C18]">From {formatCurrency(from)}</p>
        ) : null}
      </div>
    </Link>
  )
}

function OccasionGrid({
  occasions,
  products,
  priceOf,
  resolved,
}: {
  occasions: Occasion[]
  products: PublicProduct[]
  priceOf: (product: PublicProduct) => number | null
  /** Cards with their collection products already resolved (editable homepage). */
  resolved?: { card: OccasionCardData; items: PublicProduct[] }[]
}) {
  const usedIds = new Set<string>()
  const usedImages = new Set<string>()
  const sources = resolved
    ? resolved.map(({ card, items }) => ({
        occasion: { ...card, slug: card.collectionSlug } as Occasion,
        items,
      }))
    : occasions.map((occasion) => ({ occasion, items: matches(products, occasion.slug) }))
  const tiles = sources.map(({ occasion, items }) => {
    return {
      occasion,
      from: lowestPrice(items, priceOf),
      pictures: pickTileProducts(items, occasion.slug, usedIds, usedImages, occasion.size === 'large' ? 3 : 2),
    }
  })

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-0">
      {tiles.map((tile) => (
        <OccasionCard
          key={tile.occasion.slug + tile.occasion.title}
          occasion={tile.occasion}
          pictures={tile.pictures}
          from={tile.from}
        />
      ))}
    </div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  actionHref,
  action,
  tone = 'default',
  dark = false,
  accent = false,
}: {
  eyebrow?: string
  title: string
  actionHref?: string
  action?: string
  tone?: 'default' | 'retail'
  dark?: boolean
  /** Short saffron rule above the eyebrow. */
  accent?: boolean
}) {
  return (
    <div className={`mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b pb-4 ${dark ? 'border-[#7C766F]' : 'border-[#CCC5BD]'}`}>
      <div>
        {accent ? <span aria-hidden="true" className="mb-3 block h-0.5 w-10 bg-[#9E4300]" /> : null}
        {eyebrow ? (
          <p className={`font-sans text-xs uppercase tracking-wider font-semibold mb-1 ${dark ? 'text-[#FFB690]' : 'text-[#9E4300]'}`}>
            {eyebrow}
          </p>
        ) : null}
        <h2 className={`font-serif text-[1.75rem] leading-tight tracking-tight sm:text-3xl lg:text-4xl font-normal ${dark ? 'text-[#FCF9F2]' : 'text-[#1C1C18]'}`}>
          {headingParts(title).map((part, index) =>
            part.accent ? (
              <span key={index} className={`italic ${dark ? 'text-[#FFB690]' : 'text-[#9E4300]'}`}>
                {part.text}
              </span>
            ) : (
              part.text
            ),
          )}
        </h2>
      </div>
      {actionHref && action ? (
        <Link
          href={actionHref}
          className={`shrink-0 font-sans text-xs uppercase tracking-wider font-semibold underline underline-offset-4 transition-colors ${
            dark ? 'text-[#FFB690] hover:text-white' : 'text-[#9E4300] hover:text-[#1C1C18]'
          }`}
        >
          {action} &rarr;
        </Link>
      ) : null}
    </div>
  )
}

export function RetailOccasionBento({
  products,
  priceOf,
  content,
  cards,
}: {
  products: PublicProduct[]
  priceOf: (product: PublicProduct) => number | null
  content?: OccasionGridContent
  cards?: { card: OccasionCardData; items: PublicProduct[] }[]
}) {
  if (cards && !cards.length) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading
        eyebrow={content ? content.eyebrow : 'Collections'}
        title={content ? content.heading : 'Gifts by occasion'}
        actionHref={content ? content.ctaHref : '/collections'}
        action={content ? content.ctaLabel : 'View All Collections'}
        tone="retail"
      />
      {content?.subtext ? <p className="-mt-2 mb-8 max-w-xl sv2-body-sm text-[#4A4640]">{content.subtext}</p> : null}
      <OccasionGrid occasions={RETAIL_OCCASIONS} products={products} priceOf={priceOf} resolved={cards} />
    </section>
  )
}

export function BusinessOccasionBento({
  products,
  priceOf,
}: {
  products: PublicProduct[]
  priceOf: (product: PublicProduct) => number | null
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <SectionHeading
        eyebrow="Corporate Collections"
        title="Occasions &amp; Strategic Gifting Suites"
        actionHref="#catalog"
        action="Explore All Collections"
      />
      <OccasionGrid occasions={BUSINESS_OCCASIONS} products={products} priceOf={priceOf} />
    </section>
  )
}

export function BrandLogoRow({
  brands,
  title,
  eyebrow,
  tone = 'default',
  subtext = 'Branded products available through our catalogue.',
  actionHref = '/catalogue',
  action = 'View All Brands',
}: {
  brands: Brand[]
  title: string
  eyebrow?: string
  tone?: 'default' | 'retail'
  subtext?: string
  actionHref?: string
  action?: string
}) {
  const hidden = siteContent.hiddenBrandNames.map((name) => name.toLowerCase())
  const visible = brands.filter((brand) => !hidden.includes(brand.name.trim().toLowerCase()))
  if (!visible.length) return null
  return (
    <section className="border-y border-[#1C1B1A] bg-[#F6F3EC]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          actionHref={actionHref}
          action={action}
          tone={tone}
          accent
        />
        {subtext ? <p className="-mt-2 mb-8 max-w-xl sv2-body-sm text-[#4A4640]">{subtext}</p> : <div className="mb-8" />}
        <div className="flex flex-wrap justify-center border-t border-[#CCC5BD]">
          {visible.map((brand) => (
            <Link
              key={brand.id}
              href={brandPath(brand, brands)}
              className="group flex w-1/2 items-center justify-center border-b border-[#CCC5BD] px-5 py-8 text-center transition-colors hover:bg-[#FCF9F2] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#9E4300] sm:w-1/3 lg:w-1/4"
            >
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  className="h-10 w-auto max-w-full object-contain grayscale transition-[filter] duration-300 group-hover:grayscale-0 motion-reduce:transition-none"
                />
              ) : (
                <span className="font-serif text-[22px] leading-none text-[#1C1C18] decoration-[#9E4300] underline-offset-4 group-hover:underline lg:text-[26px]">
                  {brand.name}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ProductSection({
  title,
  eyebrow,
  actionHref,
  action,
  products,
  priceOf,
  showSample = true,
  captionFor,
  dark = false,
  columns = 'lg:grid-cols-5',
  tone = 'default',
}: {
  title: string
  eyebrow?: string
  actionHref?: string
  action?: string
  products: PublicProduct[]
  priceOf: (product: PublicProduct) => number | null
  showSample?: boolean
  captionFor?: (product: PublicProduct) => string
  dark?: boolean
  columns?: string
  tone?: 'default' | 'retail'
}) {
  if (!products.length) return null
  return (
    <section
      className={
        dark
          ? 'relative isolate overflow-hidden bg-[#1C1B1A] py-12 sm:py-16 text-[#FCF9F2] border-y border-[#CCC5BD]'
          : 'mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8'
      }
    >
      {dark ? (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 sv2-festive-glow" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 sv2-festive-motif" />
          <span aria-hidden="true" className="pointer-events-none absolute left-[12%] top-10 h-1 w-1 bg-[#FFB690] sv2-twinkle" />
          <span aria-hidden="true" className="pointer-events-none absolute right-[18%] top-24 h-1 w-1 bg-[#FFB690] sv2-twinkle sv2-twinkle-delay-1" />
          <span aria-hidden="true" className="pointer-events-none absolute left-[42%] bottom-12 h-1 w-1 bg-[#FFB690] sv2-twinkle sv2-twinkle-delay-2" />
        </>
      ) : null}
      <div className={dark ? 'relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8' : undefined}>
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          actionHref={actionHref}
          action={action}
          tone={tone}
          dark={dark}
          accent={dark}
        />
        <div className={`grid grid-cols-2 md:grid-cols-3 ${columns} gap-4 sm:gap-5`}>
          {products.map((product) => (
            <StitchProductCard
              key={product.id}
              product={product}
              price={priceOf(product)}
              showSample={showSample}
              caption={captionFor?.(product)}
              tone={tone}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
