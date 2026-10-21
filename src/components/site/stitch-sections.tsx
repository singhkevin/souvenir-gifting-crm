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
  tone = 'default',
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
    <div className={`mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b pb-4 ${dark ? 'border-[#7C766F]' : 'border-[#CCC5BD]'}`}>
      <div>
        {eyebrow ? (
          <p className={`font-sans text-xs uppercase tracking-wider font-semibold mb-1 ${dark ? 'text-[#FFB690]' : 'text-[#9E4300]'}`}>
            {eyebrow}
          </p>
        ) : null}
        <h2 className={`font-serif text-[1.75rem] leading-tight tracking-tight sm:text-3xl lg:text-4xl font-normal ${dark ? 'text-[#FCF9F2]' : 'text-[#1C1C18]'}`}>
          {title}
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
}: {
  products: PublicProduct[]
  priceOf: (product: PublicProduct) => number | null
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading
        eyebrow="Gift Collections"
        title="Procure by Occasion & Milestone"
        actionHref="/collections"
        action="View All Collections"
        tone="retail"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {RETAIL_OCCASIONS.map((occasion) => {
          const items = matches(products, occasion.slug)
          const sample = sampleFor(items)
          const from = lowestPrice(items, priceOf)
          const tall = occasion.size === 'large'
          return (
            <Link
              key={occasion.slug + occasion.title}
              href={occasion.href}
              className={`group relative overflow-hidden border border-[#CCC5BD] bg-[#1C1B1A] transition-colors hover:border-[#000000] ${
                tall ? 'h-56 sm:h-64' : 'h-44 sm:h-52'
              } lg:col-span-2`}
            >
              {sample ? (
                <ProductImage
                  src={sample.image_url}
                  alt=""
                  fit="cover"
                  className="absolute inset-0 h-full w-full opacity-65 sv2-img-zoom"
                />
              ) : (
                <div className="absolute inset-0 bg-[#1C1B1A]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1C1B1A]/95 via-[#1C1B1A]/50 to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-5 text-[#FCF9F2]">
                {occasion.kicker ? (
                  <span className="mb-1.5 w-max border border-[#7C766F] bg-[#1C1B1A]/85 px-2 py-0.5 sv2-label text-[10px] text-[#FFB690]">
                    {occasion.kicker}
                  </span>
                ) : null}
                <h3 className={`font-serif text-[#FCF9F2] font-normal ${tall ? 'text-[22px] leading-snug' : 'text-lg leading-snug'}`}>
                  {occasion.title}
                </h3>
                <p className="mt-1 line-clamp-2 sv2-body-sm text-xs text-[#CCC5BD]">{occasion.line}</p>
                {from != null ? (
                  <p className="mt-2.5 sv2-mono-sm text-[12px] font-bold text-[#FFB690]">
                    From {formatCurrency(from)}
                  </p>
                ) : null}
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
        className={`flex flex-col justify-between border border-[#CCC5BD] bg-[#FCF9F2] p-5 hover:border-[#000000] transition-colors ${className}`}
      >
        <div>
          <span className="sv2-label text-[10px] text-[#9E4300]">{occasion.kicker}</span>
          <h3 className="mt-2 font-serif text-xl text-[#1C1C18] font-normal">{occasion.title}</h3>
          <p className="mt-2 sv2-body-sm text-[#4A4640]">{occasion.line}</p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-[#CCC5BD] pt-3 sv2-mono-sm text-xs">
          <span className="font-bold text-[#1C1C18]">
            {from != null ? `From ${formatCurrency(from)}` : 'Price on quote'}
          </span>
          <span className="font-semibold text-[#9E4300]">View {items.length || 'collection'} &rarr;</span>
        </div>
      </Link>
    )
  }

  const [festive, welcome, onboarding, client, conference, anniversary] = BUSINESS_OCCASIONS

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <SectionHeading
        eyebrow="Corporate Collections"
        title="Occasions &amp; Strategic Gifting Suites"
        actionHref="#catalog"
        action="Explore All Collections"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Link
          href={festive.href}
          className="flex flex-col justify-between border border-[#7C766F] bg-[#1C1B1A] p-6 text-[#FCF9F2] md:col-span-2 lg:col-span-2 hover:border-[#CCC5BD] transition-colors"
        >
          <div>
            <span className="inline-block border border-[#7C766F] bg-[#31312C] px-2 py-1 sv2-label text-[10px] text-[#FFB690]">
              {festive.kicker}
            </span>
            <h3 className="mt-3 font-serif text-[22px] leading-7 text-[#FCF9F2] font-normal">{festive.title}</h3>
            <p className="mt-2 sv2-body-sm text-[#CCC5BD]">{festive.line}</p>
          </div>
          <p className="mt-6 sv2-mono-sm text-sm font-semibold text-[#FFB690]">
            {lowestPrice(matches(products, festive.slug), priceOf) != null
              ? `From ${formatCurrency(lowestPrice(matches(products, festive.slug), priceOf) as number)}`
              : 'Browse festive gifts'} &rarr;
          </p>
        </Link>
        {card(welcome, 'lg:col-span-2')}
        {card(onboarding, 'lg:col-span-1')}
        {card(client, 'bg-[#F6F3EC] lg:col-span-1')}
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
  tone = 'default',
}: {
  brands: Brand[]
  title: string
  eyebrow?: string
  tone?: 'default' | 'retail'
}) {
  if (!brands.length) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <SectionHeading eyebrow={eyebrow} title={title} actionHref="/catalogue" action="View All Brands" tone={tone} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t border-l border-[#CCC5BD]">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            href={brandPath(brand, brands)}
            className="flex h-20 items-center justify-center border-r border-b border-[#CCC5BD] bg-[#FCF9F2] px-4 text-center hover:bg-[#F6F3EC] transition-colors"
          >
            {brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={brand.name} className="max-h-9 w-auto object-contain" />
            ) : (
              <span className="font-serif text-lg leading-none text-[#1C1C18]">{brand.name}</span>
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
          ? 'bg-[#1C1B1A] py-12 sm:py-16 text-[#FCF9F2] border-y border-[#CCC5BD]'
          : 'mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8'
      }
    >
      <div className={dark ? 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8' : undefined}>
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          actionHref={actionHref}
          action={action}
          tone={tone}
          dark={dark}
        />
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${columns} gap-4 sm:gap-5`}>
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
