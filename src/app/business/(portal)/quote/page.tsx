import { QuoteBasket } from '@/components/business/quote-basket'
import { requireBusiness } from '@/lib/business/session'
import { gstPriceNote } from '@/lib/pricing/engine'
import { getPricingSettings } from '@/lib/pricing/server'

export const dynamic = 'force-dynamic'

export default async function BusinessQuotePage() {
  const { company } = await requireBusiness()
  const pendingApproval = company?.business_verification !== 'verified'
  const priceNote = gstPriceNote((await getPricingSettings()).portals.business.gstMode)
  return (
    <div className="space-y-6">
      <div>
        <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Request a quote</p>
        <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">Quote basket</h1>
        <p className="mt-1 text-sm text-[#4A4640]">
          {pendingApproval
            ? 'Pending approval. You can keep products here, and submit the request after sales approves this account.'
            : 'Submit these lines as a request. Nothing is purchased from this page.'}
        </p>
      </div>
      <QuoteBasket pendingApproval={pendingApproval} priceNote={priceNote} />
    </div>
  )
}
