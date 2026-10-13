import { QuoteBasket } from '@/components/business/quote-basket'
import { requireBusiness } from '@/lib/business/session'

export const dynamic = 'force-dynamic'

export default async function BusinessQuotePage() {
  const { company } = await requireBusiness()
  const pendingApproval = company?.business_verification !== 'verified'
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Quote basket</h1>
        <p className="mt-2 text-sm text-[#5C6570]">
          {pendingApproval
            ? 'Pending approval. You can keep products here, and submit the request after sales approves this account.'
            : 'Submit these lines as a request. Nothing is purchased from this page.'}
        </p>
      </div>
      <QuoteBasket pendingApproval={pendingApproval} />
    </div>
  )
}
