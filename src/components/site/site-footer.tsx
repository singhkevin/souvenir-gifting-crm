import Link from 'next/link'
import { appName, brandWordmark, marketingHostLabel, marketingSiteUrl } from '@/lib/brand'
import { BUDGET_BANDS } from '@/lib/catalogue/collections'
import { whatsAppHref } from '@/lib/contact/public-phone'

export function SiteFooter({
  workspaceHref,
  workspaceLabel,
  phone,
}: {
  workspaceHref?: string | null
  workspaceLabel?: string | null
  phone?: string | null
}) {
  const marketingUrl = marketingSiteUrl()
  const marketingHost = marketingHostLabel(marketingUrl)
  const whatsApp = phone ? whatsAppHref(phone) : null
  const wordmark = brandWordmark(appName())
  return (
    <footer className="mt-0 bg-charcoal text-cream">
      <div className="store-container grid gap-10 py-14 sm:py-16 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-serif text-3xl text-cream">{wordmark.lead}</p>
          {wordmark.rest ? (
            <p className="mt-1 font-mono text-[11px] font-medium tracking-[0.14em] text-charcoal-muted uppercase">{wordmark.rest}</p>
          ) : null}
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-charcoal-muted">
            Your destination for curated corporate gifts — catalogue, quotation and fulfilment in one place.
          </p>
          {phone ? (
            <p className="mt-4 text-sm text-charcoal-muted">
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="hover:text-cream">{phone}</a>
              {whatsApp ? (
                <>
                  {' · '}
                  <a href={whatsApp} className="hover:text-cream">WhatsApp</a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.08em] text-saffron uppercase">Shop</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-charcoal-muted">
            <Link href="/catalogue" className="hover:text-cream">Catalogue</Link>
            <Link href="/collections" className="hover:text-cream">Collections</Link>
            <Link href="/categories" className="hover:text-cream">Categories</Link>
            <Link href="/collections#occasions" className="hover:text-cream">Shop by Occasion</Link>
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.08em] text-saffron uppercase">Business</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-charcoal-muted">
            <Link href="/business" className="hover:text-cream">For Business</Link>
            <Link href="/request-quote" className="hover:text-cream">Request a quote</Link>
            <Link href="/about" className="hover:text-cream">About</Link>
            {workspaceHref && workspaceLabel ? (
              <Link href={workspaceHref} className="hover:text-cream">{workspaceLabel}</Link>
            ) : (
              <Link href="/login" className="hover:text-cream">Team Login</Link>
            )}
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.08em] text-saffron uppercase">Shop by price</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-charcoal-muted">
            {BUDGET_BANDS.map((band) => (
              <Link key={band.id} href={`/catalogue?budget=${encodeURIComponent(band.id)}`} className="hover:text-cream">
                {band.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-charcoal-border">
        <div className="store-container flex flex-col gap-2 py-5 font-mono text-xs text-charcoal-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {appName()}. All rights reserved.</p>
          <p className="flex flex-wrap gap-x-3">
            <span>Prices in INR</span>
            {marketingUrl && marketingHost ? (
              <a href={marketingUrl} className="hover:text-cream">{marketingHost}</a>
            ) : null}
          </p>
        </div>
      </div>
    </footer>
  )
}
