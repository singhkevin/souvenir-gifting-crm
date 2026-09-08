import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'

export const metadata: Metadata = {
  title: 'About',
  description: 'GIFFTER is a corporate gifting CRM and catalogue, from enquiry through fulfilment.',
}

export default function AboutPage() {
  return (
    <SiteShell>
      <div className="border-b border-[#E8E4DE] bg-[#F6F4F1]">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="store-eyebrow">About us</p>
          <h1 className="store-section-title mt-3">Welcome to GIFFTER.</h1>
          <p className="mt-4 text-lg leading-relaxed text-[#5C6570]">
            Your destination for curated corporate gifts and programme-ready fulfilment.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-base leading-relaxed text-[#5C6570] sm:px-6 lg:px-8">
        <p>
          GIFFTER is a corporate gifting CRM and product catalogue. Teams use it to select gifts, prepare quotations,
          manage orders and follow the work through fulfilment and invoicing.
        </p>
        <p>
          This public collection is the same catalogue the GIFFTER team maintains — not a second store, and not a
          consumer checkout. When you request a quote, the enquiry reaches the existing sales workflow.
        </p>
        <div className="pt-4">
          <Link
            href="/catalogue"
            className="inline-flex bg-[#1A3022] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
          >
            Explore Catalogue
          </Link>
        </div>
      </div>
    </SiteShell>
  )
}
