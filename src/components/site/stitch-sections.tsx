import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { StitchProductCard } from '@/components/site/stitch-product-card'
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

function sampleFor(items: PublicProduct[]) {
  return items.find((product) => product.image_url) || items[0] || null
}

export function SectionHeading({
  eyebrow,
  title,
  actionHref,
  action,
}: {
  eyebrow?: string
  title: string
  actionHref?: string
  action?: string
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#715a3e]">{eyebrow}</p>
        ) : null}
        <h2 className="font-serif text-[26px] leading-8 text-[#22180b] sm:text-[28px] sm:leading-9">{title}</h2>
      </div>
      {actionHref && action ? (
        <Link href={actionHref} className="shrink-0 text-sm font-semibold text-[#715a3e] hover:text-[#22180b]">
          {action}
        </Link>
      ) : null}
    </div>
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
    <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Curated collections"
        title="Procure by occasion & milestone"
        actionHref="/collections"
        action="Explore the catalogue"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {RETAIL_OCCASIONS.map((occasion) => {
          const items = matches(products, occasion.slug)
          const sample = sampleFor(items)
          const from = lowestPrice(items, priceOf)
          const tall = occasion.size === 'large'
          return (
            <Link
              key={occasion.slug + occasion.title}
              href={occasion.href}
              className={`group relative overflow-hidden rounded border border-[#d0c5bb] ${tall ? 'h-52 sm:h-60' : 'h-40 sm:h-48'} lg:col-span-2`}
            >
              {sample ? (
                <ProductImage
                  src={sample.image_url}
                  alt=""
                  fit="cover"
                  className="absolute inset-0 h-full w-full"
                />
              ) : (
                <div className="absolute inset-0 bg-[#382c1e]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#22180b]/95 via-[#22180b]/45 to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-4 text-[#fff8f4]">
                {occasion.kicker ? (
                  <span className="mb-1 w-max rounded bg-[#382c1e]/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#ffe088]">
                    {occasion.kicker}
                  </span>
                ) : null}
                <h3 className={`font-serif text-[#fff8f4] ${tall ? 'text-[22px] leading-7' : 'text-base'}`}>{occasion.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-[#fff8f4]/85">{occasion.line}</p>
                {from != null ? <p className="mt-2 text-sm font-bold text-[#ffe088]">From {formatCurrency(from)}</p> : null}
              </div>
            </Link>
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
  const card = (occasion: Occasion, className: string) => {
    const items = matches(products, occasion.slug)
    const from = lowestPrice(items, priceOf)
    return (
      <Link
        key={occasion.title}
        href={occasion.href}
        className={`flex flex-col justify-between rounded-xl border border-[#d0c5bb] bg-white p-5 hover:shadow-md ${className}`}
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#715a3e]">{occasion.kicker}</span>
          <h3 className="mt-2 font-serif text-xl text-[#22180b]">{occasion.title}</h3>
          <p className="mt-2 text-sm leading-5 text-[#4d453e]">{occasion.line}</p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[#d0c5bb] pt-3 text-sm">
          <span className="font-bold text-[#22180b]">{from != null ? `From ${formatCurrency(from)}` : 'Price on quote'}</span>
          <span className="font-semibold text-[#735c00]">View {items.length || 'collection'}</span>
        </div>
      </Link>
    )
  }

  const [festive, welcome, onboarding, client, conference, anniversary] = BUSINESS_OCCASIONS

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Enterprise curations"
        title="Occasions & strategic gifting suites"
        actionHref="#catalog"
        action="Explore all curations"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Link
          href={festive.href}
          className="flex flex-col justify-between rounded-xl border border-[#cca730]/40 bg-[#382c1e] p-6 text-[#fff8f4] md:col-span-2 lg:col-span-2"
        >
          <div>
            <span className="inline-block rounded bg-[#ffe088] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#241a00]">
              {festive.kicker}
            </span>
            <h3 className="mt-3 font-serif text-[22px] leading-7 text-[#fff8f4]">{festive.title}</h3>
            <p className="mt-2 text-sm text-[#e7d7c7]">{festive.line}</p>
          </div>
          <p className="mt-6 text-sm font-semibold text-[#ffe088]">
            {lowestPrice(matches(products, festive.slug), priceOf) != null
              ? `From ${formatCurrency(lowestPrice(matches(products, festive.slug), priceOf) as number)}`
              : 'Browse festive gifts'}
          </p>
        </Link>
        {card(welcome, 'lg:col-span-2')}
        {card(onboarding, 'lg:col-span-1')}
        {card(client, 'bg-[#f6e6d5] lg:col-span-1')}
        {card(conference, 'md:col-span-1 lg:col-span-3')}
        {card(anniversary, 'md:col-span-1 lg:col-span-3')}
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
}) {
  if (!brands.length) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            href={brandPath(brand, brands)}
            className="flex h-20 flex-col items-center justify-center rounded border border-[#d0c5bb] bg-white px-3 text-center hover:border-[#715a3e]"
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
}) {
  if (!products.length) return null
  return (
    <section className={dark ? 'bg-[#382c1e] py-8 text-[#fff8f4]' : 'mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8'}>
      <div className={dark ? 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8' : undefined}>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            {eyebrow ? (
              <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${dark ? 'text-[#ffe088]' : 'text-[#715a3e]'}`}>
                {eyebrow}
              </p>
            ) : null}
            <h2 className={`font-serif text-[26px] leading-8 sm:text-[28px] sm:leading-9 ${dark ? 'text-[#fff8f4]' : 'text-[#22180b]'}`}>
              {title}
            </h2>
          </div>
          {actionHref && action ? (
            <Link href={actionHref} className={`shrink-0 text-sm font-semibold ${dark ? 'text-[#ffe088]' : 'text-[#715a3e]'}`}>
              {action}
            </Link>
          ) : null}
        </div>
        <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${columns}`}>
          {products.map((product) => (
            <StitchProductCard
              key={product.id}
              product={product}
              price={priceOf(product)}
              showSample={showSample}
              caption={captionFor?.(product)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
