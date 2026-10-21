import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { QuoteForm } from '@/components/site/quote-form'
import { getProfile } from '@/lib/auth'
import { getPublicProduct } from '@/lib/catalogue/products'
import { isUuid } from '@/lib/utils'
import { appName } from '@/lib/brand'
import { siteContent } from '@/config/siteContent'

export const metadata: Metadata = {
  title: 'Request a Quote',
  description: `Request a corporate gifting quotation from ${appName()}.`,
}

export default async function RequestQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>
}) {
  const { product: productId } = await searchParams
  const profile = await getProfile()
  const product = productId && isUuid(productId) ? await getPublicProduct(productId) : null
  const portalHref =
    profile?.role === 'client_admin' || profile?.role === 'client_user' ? '/portal/quote-basket' : null

  return (
    <SiteShell>
      <div className="border-b border-[#3A3835] bg-[#1C1B1A] text-[#FCF9F2]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-xs uppercase tracking-wider text-[#FFB690]">
            <Link href="/home" className="hover:underline">
              Home
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <span className="text-[#FCF9F2]">Request a Quote</span>
          </p>
          <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-serif text-3xl font-normal tracking-tight text-[#FCF9F2] sm:text-4xl lg:text-5xl">
                Tell us about your programme.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#CCC5BD]">
                Share the occasion, estimated quantity and delivery deadline. Our team prepares a complete formal quotation with customisation, packaging and GST compliance.
              </p>
            </div>
            <div className="font-sans text-xs uppercase tracking-wider text-[#CCC5BD] shrink-0 border border-[#3A3835] bg-[#242220] px-3.5 py-2">
              {siteContent.stats.quoteTurnaround}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5 space-y-6">
            <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-6 space-y-4">
              <h2 className="font-serif text-xl text-[#1C1B1A]">What to expect</h2>
              <ul className="space-y-3 font-sans text-sm text-[#4A4640]">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-bold text-[#9E4300] mt-0.5">01</span>
                  <span><strong>Dedicated Support:</strong> An account manager responds with sample availability and initial options.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-bold text-[#9E4300] mt-0.5">02</span>
                  <span><strong>Branding &amp; Packaging:</strong> Digital mockups for laser engraving, debossing, hot foil or custom tags.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-bold text-[#9E4300] mt-0.5">03</span>
                  <span><strong>Transparent Pricing:</strong> Tiered quantity pricing with itemised GST invoice.</span>
                </li>
              </ul>
            </div>

            {product ? (
              <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-6">
                <span className="text-[10px] uppercase tracking-widest text-[#9E4300] block mb-1">
                  SELECTED GIFT
                </span>
                <p className="font-serif text-lg text-[#1C1B1A]">{product.name}</p>
                <p className="font-mono text-xs text-[#7C766F] mt-1">SKU: {product.sku}</p>
              </div>
            ) : null}

            <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-6 font-mono text-xs text-[#4A4640] space-y-2">
              <div className="flex justify-between">
                <span className="text-[#7C766F]">EMAIL DESK:</span>
                <span className="text-[#1C1B1A] font-semibold">{siteContent.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7C766F]">PHONE:</span>
                <span className="text-[#1C1B1A] font-semibold">{siteContent.phone}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 border border-[#CCC5BD] bg-[#FCF9F2] p-6 sm:p-8">
            <QuoteForm productId={product?.id} productName={product?.name} portalHref={portalHref} />
          </div>
        </div>
      </div>
    </SiteShell>
  )
}
