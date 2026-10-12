import { QuoteBasket } from '@/components/business/quote-basket'

export const dynamic = 'force-dynamic'

export default function BusinessQuotePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Quote basket</h1>
        <p className="mt-2 text-sm text-[#5C6570]">Submit these lines as a request. Nothing is purchased from this page.</p>
      </div>
      <QuoteBasket />
    </div>
  )
}
