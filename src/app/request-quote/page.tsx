import type { Metadata } from 'next'
import { SiteShell } from '@/components/site/site-shell'
import { QuoteForm } from '@/components/site/quote-form'
import { getProfile } from '@/lib/auth'
import { getPublicProduct } from '@/lib/catalogue/products'
import { isUuid } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Request a Quote',
  description: 'Request a corporate gifting quotation from Gifting Solutions.',
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
    profile?.role === 'client_admin' || profile?.role === 'client_user' ? '/portal/requirements/new' : null

  return (
    <SiteShell>
      <div className="border-b border-[#E8E4DE] bg-[#F6F4F1]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="store-eyebrow">Request a quote</p>
          <h1 className="store-section-title mt-2">Tell us about the programme.</h1>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="max-w-md text-sm leading-relaxed text-[#5C6570]">
            Share the occasion, quantity and timing. We will come back with a quotation — branding, packaging and
            fulfilment included.
          </p>
        </div>
        <div className="rounded-md border border-[#E8E4DE] bg-white p-6 sm:p-8">
          <QuoteForm productId={product?.id} productName={product?.name} portalHref={portalHref} />
        </div>
      </div>
    </SiteShell>
  )
}
