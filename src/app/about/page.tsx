import type { Metadata } from 'next'
import { SiteShell } from '@/components/site/site-shell'

export const metadata: Metadata = {
  title: 'About',
  description: 'GIFFTER is a corporate gifting CRM and catalogue, from enquiry through fulfilment.',
}

export default function AboutPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#7A7267]">About</p>
        <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">Gifting, as an operating system.</h1>
        <div className="mt-10 space-y-6 text-base leading-relaxed text-[#5A5248]">
          <p>
            GIFFTER is a corporate gifting CRM and product catalogue. Teams use it to select gifts, prepare quotations,
            manage orders and follow the work through fulfilment and invoicing.
          </p>
          <p>
            This public collection is the same catalogue the GIFFTER team maintains — not a second store, and not a
            consumer checkout. When you request a quote, the enquiry reaches the existing sales workflow.
          </p>
        </div>
      </div>
    </SiteShell>
  )
}
