import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'

export const storeFieldClass =
  'mt-1 w-full rounded-lg border border-[#eadfd4] bg-white px-3 py-2.5 text-sm text-[#22180b] outline-none placeholder:text-[#7f756d] focus:border-[#735c00]'

export function StorePageHeader({
  eyebrow,
  title,
  lede,
  crumbs,
}: {
  eyebrow?: string
  title: string
  lede?: React.ReactNode
  crumbs?: { href: string; label: string }[]
}) {
  return (
    <div className="border-b border-[#eadfd4]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        {crumbs?.length ? (
          <p className="text-sm text-[#4d453e]">
            {crumbs.map((crumb, index) => (
              <span key={crumb.href}>
                {index > 0 ? <span className="mx-2 text-[#d7c4a4]">/</span> : null}
                <Link href={crumb.href} className="hover:text-[#735c00]">
                  {crumb.label}
                </Link>
              </span>
            ))}
            <span className="mx-2 text-[#d7c4a4]">/</span>
            <span className="text-[#22180b]">{title}</span>
          </p>
        ) : null}
        {eyebrow ? <p className={`store-eyebrow ${crumbs?.length ? 'mt-3' : ''}`}>{eyebrow}</p> : null}
        <h1 className={`store-section-title ${eyebrow || crumbs?.length ? 'mt-2' : ''}`}>{title}</h1>
        {lede ? <p className="mt-3 max-w-xl text-sm leading-6 text-[#4d453e]">{lede}</p> : null}
      </div>
    </div>
  )
}

export function StoreTitle({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string
  title: string
  lede?: React.ReactNode
}) {
  return (
    <div>
      {eyebrow ? <p className="store-eyebrow">{eyebrow}</p> : null}
      <h1 className={`store-section-title ${eyebrow ? 'mt-2' : ''}`}>{title}</h1>
      {lede ? <p className="mt-2 max-w-xl text-sm leading-6 text-[#4d453e]">{lede}</p> : null}
    </div>
  )
}

export function StoreSectionHeading({
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
  dark?: boolean
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <div>
        {eyebrow ? (
          <p className={`text-[11px] font-semibold tracking-[0.22em] uppercase ${dark ? 'text-[#ffe088]' : 'text-[#735c00]'}`}>
            {eyebrow}
          </p>
        ) : null}
        <h2 className={`font-serif text-[1.75rem] leading-tight tracking-tight sm:text-4xl ${dark ? 'text-[#fff8f4]' : 'text-[#22180b]'}`}>
          {title}
        </h2>
      </div>
      {actionHref && action ? (
        <Link
          href={actionHref}
          className={`shrink-0 text-sm font-semibold underline decoration-[#c4a35a] underline-offset-4 ${dark ? 'text-[#ffe088] hover:text-white' : 'text-[#382c1e] hover:text-[#735c00]'}`}
        >
          {action}
        </Link>
      ) : null}
    </div>
  )
}

export function StoreButton({
  href,
  children,
  variant = 'solid',
  className = '',
}: {
  href: string
  children: React.ReactNode
  variant?: 'solid' | 'line' | 'inverse'
  className?: string
}) {
  const styles = {
    solid: 'bg-[#22180b] text-white hover:bg-[#382c1e]',
    line: 'border border-[#22180b] text-[#22180b] hover:bg-[#fff1e5]',
    inverse: 'border border-white/75 text-white hover:bg-white/10',
  }[variant]
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center px-5 py-3 text-[11px] font-semibold tracking-[0.16em] uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#735c00] ${styles} ${className}`}
    >
      {children}
    </Link>
  )
}

export function StoreCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-[#eadfd4] bg-white shadow-[0_8px_24px_rgba(34,24,11,0.05)] ${className}`}>
      {children}
    </div>
  )
}

export function OverlayCard({
  href,
  image,
  eyebrow,
  title,
  subtitle,
  meta,
  className = '',
}: {
  href: string
  image?: string | null
  eyebrow?: string
  title: string
  subtitle?: string
  meta: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`group relative block h-60 overflow-hidden rounded-xl border border-[#eadfd4] bg-[#280f14] shadow-[0_8px_24px_rgba(34,24,11,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(34,24,11,0.1)] sm:h-64 ${className}`}
    >
      {image ? (
        <ProductImage
          src={image}
          alt=""
          fit="cover"
          className="absolute inset-0 h-full w-full transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(40,15,20,0.92) 0%, rgba(40,15,20,0.6) 45%, transparent 75%)',
        }}
      />
      <div className="relative flex h-full flex-col justify-end p-4 text-white" style={{ textShadow: '0 1px 2px rgba(20, 8, 10, 0.55)' }}>
        {eyebrow ? <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffe088]">{eyebrow}</p> : null}
        <h3 className="mt-1 font-serif text-lg leading-6 text-white sm:text-[22px] sm:leading-7">{title}</h3>
        {subtitle ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#f6eadc]">{subtitle}</p> : null}
        <p className="mt-2 text-sm font-semibold text-[#ffe088]">{meta}</p>
      </div>
    </Link>
  )
}
