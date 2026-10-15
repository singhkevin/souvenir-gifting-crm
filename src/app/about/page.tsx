import type { Metadata } from 'next'
import { appName } from '@/lib/brand'
import { BrandName } from '@/components/brand/brand-name'
import { SiteShell } from '@/components/site/site-shell'
import { StoreButton, StorePageHeader } from '@/components/site/store-ui'

export const metadata: Metadata = {
  title: 'About',
  description: `${appName()} is a gift catalogue you can shop, with a business desk for larger programmes.`,
}

export default function AboutPage() {
  return (
    <SiteShell>
      <StorePageHeader
        eyebrow="About us"
        title={`Welcome to ${appName()}.`}
        lede="Curated gifts for every occasion, and a business desk when a programme needs a quotation."
      />

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-base leading-7 text-[#4d453e] sm:px-6 lg:px-8">
        <p>
          <BrandName /> keeps one catalogue. On the shop you can add an in-stock gift to your cart and check out.
          Sample-only pieces stay off the cart.
        </p>
        <p>
          Teams that need branding, larger quantities, or a formal quotation use Business. Those prices stay indicative
          until a quote is sent.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <StoreButton href="/catalogue">Shop gifts</StoreButton>
          <StoreButton href="/business" variant="line">
            Business
          </StoreButton>
        </div>
      </div>
    </SiteShell>
  )
}
