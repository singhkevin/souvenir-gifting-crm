import Link from 'next/link'
import { StitchProductCard } from '@/components/site/stitch-product-card'
import { OverlayCard, StoreSectionHeading } from '@/components/site/store-ui'
import { brandPath } from '@/lib/catalogue/store-nav'
import { collectionBySlug } from '@/lib/catalogue/collections'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'

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
    line: 'Hampers and festive boxes, ready to give',
    href: '/collections/festival-gifting',
    slug: 'festival-gifting',
    size: 'large',
  },
  {
    title: 'Welcome Gifts',
    kicker: 'Just because',
    line: 'A warm start, ready to give',
    href: '/collections/welcome-kits',
    slug: 'welcome-kits',
    size: 'large',
  },
  {
    title: 'For Someone Special',
    kicker: 'Appreciation',
    line: 'Gifts for the people you care about',
    href: '/collections/client-appreciation',
    slug: 'client-appreciation',
    size: 'large',
  },
  {
    title: 'Everyday Favourites',
    kicker: 'Small gifts',
    line: 'Little things that still feel considered',
    href: '/collections/new-joiner-essentials',
    slug: 'new-joiner-essentials',
    size: 'small',
  },
  {
    title: 'Gatherings',
    kicker: 'Events',
    line: 'Drinkware and desk pieces for the room',
    href: '/collections/conference-and-events',
    slug: 'conference-and-events',
    size: 'small',
  },
  {
    title: 'Milestones',
    kicker: 'Dates that matter',
    line: 'Keepsakes for the moments you mark',
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

function sampleFor(items: PublicProduct[]) {
  return items.find((product) => product.image_url) || items[0] || null
}

export function SectionHeading({
  eyebrow,
  title,
  actionHref,
  action,
  dark = false,
}: {
  eyebrow?: string
  title: string
  actionHref?: string
  action?: string
  tone?: 'default' | 'retail'
  dark?: boolean
}) {
  return (
    <StoreSectionHeading eyebrow={eyebrow} title={title} actionHref={actionHref} action={action} dark={dark} />
  )
}

export function RetailOccasionBento({
  products,
  priceOf,
}: {
  products: PublicProduct[]
  priceOf: (product: PublicProduct) => number | null
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading
        eyebrow="Curated collections"
        title="Gifts for every occasion"
        actionHref="/collections"
        action="View all"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {RETAIL_OCCASIONS.map((occasion) => {
          const items = matches(products, occasion.slug)
          const from = lowestPrice(items, priceOf)
          return (
            <OverlayCard
              key={occasion.slug + occasion.title}
              href={occasion.href}
              image={sampleFor(items)?.image_url}
              eyebrow={occasion.kicker}
              title={occasion.title}
              subtitle={occasion.line}
              meta={from != null ? `From ${formatCurrency(from)} · Explore →` : 'Explore →'}
              className="lg:col-span-2"
            />
          )
        })}
      </div>
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
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading
        eyebrow="For teams"
        title="Occasions and gifting suites"
        actionHref="#catalog"
        action="Explore all"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {BUSINESS_OCCASIONS.map((occasion) => {
          const items = matches(products, occasion.slug)
          const from = lowestPrice(items, priceOf)
          return (
            <OverlayCard
              key={occasion.title}
              href={occasion.href}
              image={sampleFor(items)?.image_url}
              eyebrow={occasion.kicker}
              title={occasion.title}
              subtitle={occasion.line}
              meta={from != null ? `From ${formatCurrency(from)} · View` : 'Price on quote · View'}
              className="lg:col-span-2"
            />
          )
        })}
      </div>
    </section>
  )
}

export function BrandLogoRow({
  brands,
  title,
  eyebrow,
}: {
  brands: Brand[]
  title: string
  eyebrow?: string
  tone?: 'default' | 'retail'
}) {
  if (!brands.length) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading eyebrow={eyebrow} title={title} actionHref="/brands" action="View all" />
      <div className="flex overflow-x-auto rounded-xl border border-[#eadfd4] bg-white shadow-[0_8px_24px_rgba(34,24,11,0.04)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {brands.map((brand, index) => (
          <Link
            key={brand.id}
            href={brandPath(brand, brands)}
            className={`flex h-20 min-w-36 flex-1 items-center justify-center px-4 text-center hover:bg-[#fbf6f0] ${index > 0 ? 'border-l border-[#eadfd4]' : ''}`}
          >
            {brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={brand.name} className="max-h-10 w-auto object-contain" />
            ) : (
              <span className="font-serif text-lg leading-none text-[#22180b]">{brand.name}</span>
            )}
          </Link>
        ))}
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
          ? 'bg-[#2a2118] py-14 text-[#fff8f4] sm:py-16'
          : 'mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8'
      }
    >
      <div className={dark ? 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8' : undefined}>
        <SectionHeading eyebrow={eyebrow} title={title} actionHref={actionHref} action={action} dark={dark} />
        <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 ${columns}`}>
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
