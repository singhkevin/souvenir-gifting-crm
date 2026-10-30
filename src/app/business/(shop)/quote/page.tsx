import { QuoteBasket } from '@/components/business/quote-basket'
import { getBusinessAccess } from '@/lib/business/access'
import { gstPriceNote } from '@/lib/pricing/engine'
import { getPricingSettings } from '@/lib/pricing/server'

export const dynamic = 'force-dynamic'

export default async function BusinessQuotePage() {
  const access = await getBusinessAccess()
  const signedIn = access.state === 'pending' || access.state === 'verified'
  const pendingApproval = access.state === 'pending'
  const priceNote = access.canSeePrices ? gstPriceNote((await getPricingSettings()).portals.business.gstMode) : 'excl. GST'
  return (
    <div className="space-y-6">
      <div>
        <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Request a quote</p>
        <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">Quote basket</h1>
        <p className="mt-1 text-sm text-[#4A4640]">
          {signedIn
            ? pendingApproval
              ? 'Awaiting approval · you can keep products here, and submit the request after we verify your company.'
              : 'Submit these lines as one quote request. Nothing is purchased from this page.'
            : 'Build a quote here. Sign in with a business account when you are ready to send it. Nothing is purchased from this page.'}
        </p>
      </div>
      <QuoteBasket
        pendingApproval={pendingApproval}
        priceNote={priceNote}
        signedIn={signedIn}
        showPrices={access.canSeePrices}
      />
    </div>
  )
}
