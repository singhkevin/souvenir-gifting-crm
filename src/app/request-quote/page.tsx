import type { Metadata } from 'next'
import { SiteShell } from '@/components/site/site-shell'
import { QuoteForm } from '@/components/site/quote-form'
import { getProfile } from '@/lib/auth'
import { getPublicProduct } from '@/lib/catalogue/products'
import { isUuid } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Request a Quote',
  description: 'Request a corporate gifting quotation from GIFFTER.',
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
      <div className="mx-auto grid max-w-6xl gap-16 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#7A7267]">Request a quote</p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">Tell us about the programme.</h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-[#6B6358]">
            Share the occasion, quantity and timing. We will come back with a quotation — branding, packaging and
            fulfilment included.
          </p>
        </div>
        <QuoteForm productId={product?.id} productName={product?.name} portalHref={portalHref} />
      </div>
    </SiteShell>
  )
}
