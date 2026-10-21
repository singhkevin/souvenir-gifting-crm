import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { SV2Button } from '@/components/sv2/button'
import { CartCheckout } from '@/components/site/cart-checkout'
import { loadQuoteCheckout } from '@/lib/business/quote-checkout'
import { formatCurrency } from '@/lib/utils'
import { siteContent } from '@/config/siteContent'

export const dynamic = 'force-dynamic'

export default async function QuoteCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string }>
}) {
  const { quote = '' } = await searchParams
  const view = quote ? await loadQuoteCheckout(quote) : { ok: false as const, reason: 'invalid' as const }

  return (
    <SiteShell>
      {/* Checkout Progress Strip */}
      <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-4 py-3 sm:px-6 lg:px-16">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <nav aria-label="Checkout Progress" className="flex flex-wrap items-center gap-x-4 gap-y-1 sv2-label text-[11px]">
            <div className="flex items-center gap-1.5 text-[#9E4300] font-bold">
              <span className="sv2-mono-sm">01</span>
              <span>Delivery</span>
            </div>
            <span className="text-[#CCC5BD]">/</span>
            <div className="flex items-center gap-1.5 text-[#1C1C18] font-semibold">
              <span className="sv2-mono-sm">02</span>
              <span>Review &amp; Confirmation</span>
            </div>
            <span className="text-[#CCC5BD]">/</span>
            <div className="flex items-center gap-1.5 text-[#7C766F]">
              <span className="sv2-mono-sm">03</span>
              <span>Dispatch</span>
            </div>
          </nav>

          <div className="flex items-center gap-2 font-sans text-[10px] text-[#4A4640] font-semibold">
            <span className="border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-0.5">
              SECURE CHECKOUT
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-16 lg:py-14">
        {!view.ok ? (
          <div className="mx-auto max-w-lg border border-[#CCC5BD] bg-[#FCF9F2] p-8 text-center space-y-4">
            <div className="font-sans text-xs text-[#BA1A1A] uppercase tracking-wider font-semibold">CHECKOUT UNAVAILABLE</div>
            <h1 className="font-serif text-2xl font-normal text-[#1C1C18]">Checkout link unavailable</h1>
            <p className="sv2-body-sm text-[#4A4640]">
              {view.reason === 'used'
                ? 'This checkout link has already been used to place an order.'
                : view.reason === 'expired'
                  ? 'This quoted checkout link has expired.'
                  : 'This checkout link is not valid or has been revoked.'}
            </p>
            <div className="pt-2">
              <SV2Button href="/catalogue">Return to catalogue</SV2Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
            {/* Left Column: Delivery & Recipient Form */}
            <div className="lg:col-span-7 space-y-6">
              <div className="border-b border-[#CCC5BD] pb-4">
                <span className="font-sans text-xs text-[#9E4300] uppercase tracking-wider font-semibold block mb-1">
                  Step 01: Dispatch Address
                </span>
                <h1 className="font-serif text-3xl font-normal text-[#1C1C18]">
                  Shipping &amp; Delivery Details
                </h1>
                <p className="sv2-body-sm text-[#4A4640] mt-1">
                  Where should our courier deliver your order?
                </p>
              </div>

              {/* Gift Packaging Note */}
              <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-4 space-y-1">
                <span className="sv2-label text-[10px] text-[#9E4300] block uppercase tracking-wider">
                  Packaging
                </span>
                <p className="sv2-body-sm text-xs text-[#4A4640]">
                  {siteContent.retail.packagingNote}
                </p>
              </div>

              {/* Cart Checkout Form */}
              <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-6">
                <CartCheckout
                  items={[]}
                  kind="store"
                  quoteLock={view}
                  onDone={() => undefined}
                />
              </div>

              <div>
                <Link
                  href="/catalogue"
                  className="sv2-label text-[11px] text-[#9E4300] hover:underline inline-flex items-center gap-1"
                >
                  &larr; Back to the catalogue
                </Link>
              </div>
            </div>

            {/* Right Column: Quoted Order Summary */}
            <div className="lg:col-span-5 border border-[#CCC5BD] bg-[#F6F3EC] p-6 space-y-5">
              <div className="border-b border-[#CCC5BD] pb-3 flex justify-between items-baseline">
                <h2 className="font-serif text-xl font-normal text-[#1C1C18]">Order Summary</h2>
                <span className="sv2-mono-sm text-xs text-[#9E4300] font-semibold">{view.quotationNumber}</span>
              </div>

              <p className="sv2-body-sm text-xs text-[#7C766F]">
                Locked at the quoted price. Stock and catalogue flags are not rechecked.
              </p>

              {/* Order items */}
              <ul className="divide-y divide-[#CCC5BD] border-y border-[#CCC5BD] max-h-80 overflow-y-auto">
                {view.lines.map((line) => (
                  <li key={`${line.sku}-${line.name}`} className="flex justify-between gap-3 py-3 sv2-body-sm text-sm">
                    <div className="min-w-0">
                      <span className="block font-medium text-[#1C1C18] truncate">{line.name}</span>
                      <span className="sv2-mono-sm text-xs text-[#7C766F]">
                        {line.sku} &middot; {line.quantity} &times; {formatCurrency(line.unitPrice)}
                      </span>
                    </div>
                    <span className="sv2-mono-md font-bold text-[#1C1C18] shrink-0">
                      {formatCurrency(line.quantity * line.unitPrice)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Price Breakdown */}
              <div className="space-y-2 sv2-mono-sm text-xs border-b border-[#CCC5BD] pb-3">
                <div className="flex justify-between text-[#4A4640]">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#1C1C18]">{formatCurrency(view.total)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-[#CCC5BD] text-[#1C1C18]">
                  <span className="sv2-label font-bold text-[11px]">Total</span>
                  <span className="sv2-mono-lg font-bold text-[#1C1C18] text-xl">{formatCurrency(view.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteShell>
  )
}
