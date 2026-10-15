import Image from 'next/image'
import Link from 'next/link'
import { ShopModeGate } from '@/components/site/shop-mode-gate'
import { appName, marketingHostLabel, marketingSiteUrl } from '@/lib/brand'
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
  return (
    <footer className="mt-0 border-t border-[#715a3e] bg-[#382c1e] text-[#f4dfca]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:gap-10 sm:px-6 sm:py-14 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="md:col-span-2 lg:col-span-1">
          <div className="inline-block rounded bg-white px-2 py-1">
            <Image src="/logo.png" alt={appName()} width={196} height={85} className="h-16 w-auto" />
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#d7c3af]">
            <ShopModeGate mode="business" fallback={<>Curated gifts for every occasion, ready to order.</>}>
              Curated gifts for teams and clients — catalogue, quotation and fulfilment in one place.
            </ShopModeGate>
          </p>
          {phone ? (
            <p className="mt-4 text-sm text-[#d7c3af]">
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="hover:text-white">{phone}</a>
              {whatsApp ? (
                <>
                  {' · '}
                  <a href={whatsApp} className="hover:text-white">WhatsApp</a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffe088]">Shop</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#d7c3af]">
            <Link href="/catalogue" className="hover:text-white">
              Catalogue
            </Link>
            <Link href="/collections" className="hover:text-white">
              Collections
            </Link>
            <Link href="/categories" className="hover:text-white">
              Categories
            </Link>
            <Link href="/collections#occasions" className="hover:text-white">
              Shop by Occasion
            </Link>
            <ShopModeGate mode="business">
              <Link href="/request-quote" className="hover:text-white">
                Request a Quote
              </Link>
            </ShopModeGate>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffe088]">About us</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#d7c3af]">
            <Link href="/about" className="hover:text-white">
              About
            </Link>
            {workspaceHref && workspaceLabel ? (
              <Link href={workspaceHref} className="hover:text-white">
                {workspaceLabel}
              </Link>
            ) : (
              <Link href="/login" className="hover:text-white">
                Team Login
              </Link>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffe088]">Shop by price</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#d7c3af]">
            {BUDGET_BANDS.map((band) => (
              <Link key={band.id} href={`/catalogue?budget=${encodeURIComponent(band.id)}`} className="hover:text-white">
                {band.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#715a3e]/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-[#d7c3af] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {appName()}. All rights reserved.</p>
          <p className="flex flex-wrap gap-x-3">
            <ShopModeGate mode="business" fallback={<span>Gifts for every occasion.</span>}>
              <span>Gifting for teams, clients and brands.</span>
            </ShopModeGate>
            {marketingUrl && marketingHost ? (
              <a href={marketingUrl} className="hover:text-white">
                {marketingHost}
              </a>
            ) : null}
          </p>
        </div>
      </div>
    </footer>
  )
}
