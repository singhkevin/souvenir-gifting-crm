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
  numeral,
}: {
  eyebrow?: string
  title: string
  actionHref?: string
  action?: string
  tone?: 'default' | 'retail'
  dark?: boolean
  numeral?: string
}) {
  if (tone === 'retail') {
    return (
      <div className={`mb-8 flex items-end justify-between gap-4 border-b pb-5 sm:mb-10 ${dark ? 'border-charcoal-border' : 'border-cream-border'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-6">
          {numeral ? <span className="section-numeral">{numeral}</span> : null}
          <div>
            {eyebrow ? <p className="store-eyebrow">{eyebrow}</p> : null}
            <h2 className="store-section-title">{title}</h2>
          </div>
        </div>
        {actionHref && action ? (
          <Link
            href={actionHref}
            className={`shrink-0 border-b pb-0.5 font-mono text-[13px] font-medium tracking-[0.08em] uppercase ${
              dark ? 'border-cream text-cream hover:text-saffron' : 'border-ink text-ink hover:border-gold-deep hover:text-gold-deep'
            }`}
          >
            {action}
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="store-eyebrow">{eyebrow}</p>
        ) : null}
        <h2 className="font-serif text-[26px] leading-8 text-ink sm:text-[28px] sm:leading-9">{title}</h2>
      </div>
      {actionHref && action ? (
        <Link href={actionHref} className="shrink-0 text-sm font-semibold text-gold-deep hover:text-ink">
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
    <section className="store-container py-12 sm:py-16 lg:py-20">
      <SectionHeading
        numeral="01"
        eyebrow="Curated collections"
        title="Procure by occasion & milestone"
        actionHref="/collections"
        action="View all"
        tone="retail"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RETAIL_OCCASIONS.map((occasion) => {
          const items = matches(products, occasion.slug)
          const sample = sampleFor(items)
          const from = lowestPrice(items, priceOf)
          return (
            <Link
              key={occasion.slug + occasion.title}
              href={occasion.href}
              className="group flex h-full flex-col overflow-hidden rounded border border-cream-border bg-cream-card shadow-sm transition-[transform,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-saffron-border"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-cream-surface">
                {sample ? (
                  <ProductImage
                    src={sample.image_url}
                    alt=""
                    fit="cover"
                    className="absolute inset-0 h-full w-full transition-transform duration-150 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-cream-surface" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                {occasion.kicker ? (
                  <span className="font-mono text-[11px] font-medium tracking-[0.06em] text-gold-deep uppercase">{occasion.kicker}</span>
                ) : null}
                <h3 className="mt-1 font-serif text-[1.35rem] text-ink">{occasion.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-ink-secondary">{occasion.line}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  {from != null ? <span className="font-mono text-sm font-medium text-ink">From {formatCurrency(from)}</span> : <span />}
                  <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-ink uppercase">Explore →</span>
                </div>
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
        className={`flex flex-col justify-between rounded border border-cream-border bg-cream-card p-5 hover:shadow-md ${className}`}
      >
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gold-deep">{occasion.kicker}</span>
          <h3 className="mt-2 font-serif text-xl text-ink">{occasion.title}</h3>
          <p className="mt-2 text-sm leading-5 text-ink-secondary">{occasion.line}</p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-cream-border pt-3 text-sm">
          <span className="font-bold text-ink">{from != null ? `From ${formatCurrency(from)}` : 'Price on quote'}</span>
          <span className="font-semibold text-gold-deep">View {items.length || 'collection'}</span>
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
          className="flex flex-col justify-between rounded border border-saffron-border bg-charcoal p-6 text-cream md:col-span-2 lg:col-span-2"
        >
          <div>
            <span className="inline-block rounded-sm bg-saffron px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-charcoal">
              {festive.kicker}
            </span>
            <h3 className="mt-3 font-serif text-[22px] leading-7 text-cream">{festive.title}</h3>
            <p className="mt-2 text-sm text-charcoal-muted">{festive.line}</p>
          </div>
          <p className="mt-6 text-sm font-semibold text-saffron">
            {lowestPrice(matches(products, festive.slug), priceOf) != null
              ? `From ${formatCurrency(lowestPrice(matches(products, festive.slug), priceOf) as number)}`
              : 'Browse festive gifts'}
          </p>
        </Link>
        {card(welcome, 'lg:col-span-2')}
        {card(onboarding, 'lg:col-span-1')}
        {card(client, 'bg-saffron-tint lg:col-span-1')}
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
  numeral,
}: {
  brands: Brand[]
  title: string
  eyebrow?: string
  tone?: 'default' | 'retail'
  numeral?: string
}) {
  if (!brands.length) return null
  if (tone === 'retail') {
    return (
      <section className="store-container py-12 sm:py-16 lg:py-20">
        <SectionHeading numeral={numeral} eyebrow={eyebrow} title={title} actionHref="/catalogue" action="View all" tone="retail" />
        <div className="flex overflow-x-auto rounded border border-cream-border bg-cream-card shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {brands.map((brand, index) => (
            <Link
              key={brand.id}
              href={brandPath(brand, brands)}
              className={`flex h-20 min-w-36 flex-1 items-center justify-center px-4 text-center hover:bg-cream-surface ${index > 0 ? 'border-l border-cream-border' : ''}`}
            >
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt={brand.name} className="max-h-10 w-auto object-contain" />
              ) : (
                <span className="font-serif text-lg leading-none text-ink">{brand.name}</span>
              )}
            </Link>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            href={brandPath(brand, brands)}
            className="flex h-20 flex-col items-center justify-center rounded border border-cream-border bg-cream-card px-3 text-center hover:border-saffron"
          >
            {brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={brand.name} className="max-h-10 w-auto object-contain" />
            ) : (
              <span className="font-serif text-lg leading-none text-ink">{brand.name}</span>
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
  numeral,
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
  numeral?: string
}) {
  if (!products.length) return null
  const retail = tone === 'retail'
  return (
    <section
      className={
        dark
          ? retail
            ? 'bg-charcoal py-14 text-cream sm:py-16'
            : 'bg-charcoal py-8 text-cream'
          : retail
            ? 'py-12 sm:py-16 lg:py-20'
            : 'py-4'
      }
    >
      <div className={retail || dark ? 'store-container' : 'store-container'}>
        {retail ? (
          <SectionHeading numeral={numeral} eyebrow={eyebrow} title={title} actionHref={actionHref} action={action} tone="retail" dark={dark} />
        ) : (
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              {eyebrow ? (
                <p className={`store-eyebrow ${dark ? 'text-saffron' : ''}`}>
                  {eyebrow}
                </p>
              ) : null}
              <h2 className={`font-serif text-[26px] leading-8 sm:text-[28px] sm:leading-9 ${dark ? 'text-cream' : 'text-ink'}`}>
                {title}
              </h2>
            </div>
            {actionHref && action ? (
              <Link href={actionHref} className={`shrink-0 text-sm font-semibold ${dark ? 'text-saffron' : 'text-gold-deep'}`}>
                {action}
              </Link>
            ) : null}
          </div>
        )}
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${retail ? 'gap-4' : 'gap-3'} ${columns}`}>
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
