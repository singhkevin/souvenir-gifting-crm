import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { CatalogueShortlistButton } from '@/components/portal/catalogue-shortlist-button'
import { RequestQuoteButton } from '@/components/portal/request-quote-button'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { PORTAL_CART_KEY } from '@/lib/catalogue/cart'
import { purchaseCaption, purchaseOfferFromProduct } from '@/lib/catalogue/purchase-path'
import { headers } from 'next/headers'
import { readTenantFromHeaders } from '@/lib/portal-host'
import { getCompanyMarginPercent, sellPricesForSurface } from '@/lib/pricing/server'

export default async function PortalProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Basic shape check first: an invalid uuid would otherwise surface a database
  // error instead of a clean "not available" page.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound()
  }

  const supabase = await createClient()

  // Reading through client_products means an id belonging to another company's
  // catalogue simply returns no row. The response is an ordinary "not available"
  // page that reveals nothing about whether the product exists.
  const withPurchase = 'id, name, sku, description, image_url, price, moq, category_name, brand_name, stock_qty, fulfillment_mode'
  const withoutPurchase = 'id, name, sku, description, image_url, price, moq, category_name, brand_name'
  let productResult = await supabase.from('client_products').select(withPurchase).eq('id', id).maybeSingle()
  if (productResult.error && /stock_qty|fulfillment_mode/i.test(productResult.error.message)) {
    productResult = await supabase.from('client_products').select(withoutPurchase).eq('id', id).maybeSingle()
  }
  const product = productResult.data

  if (!product) notFound()

  const tenant = readTenantFromHeaders(await headers())
  if (tenant) {
    const { data: companyId } = await supabase.rpc('client_company_id')
    const companyMargin = companyId ? await getCompanyMarginPercent(companyId) : null
    const micrositePrices = await sellPricesForSurface([product.id], 'microsite', companyMargin)
    if (micrositePrices?.has(product.id)) product.price = micrositePrices.get(product.id) ?? null
  }

  const purchase = purchaseOfferFromProduct(product)
  const shortlistProduct = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    image_url: product.image_url,
    category_name: product.category_name,
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackButton href="/portal/catalogue" label="Back to gifts" className="min-h-10" />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <ProductImage src={product.image_url} alt={product.name} size="hero" className="h-72 border-b border-gray-100 md:h-full md:border-b-0 md:border-r" />

          <div className="space-y-4 p-5 sm:p-6">
            {product.category_name && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                {product.category_name}
              </p>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>

            {product.brand_name && <p className="text-xs text-gray-500">by {product.brand_name}</p>}

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
              {product.description || 'Get in touch and we will share full details, samples and branding options.'}
            </p>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xl font-semibold text-gray-900">{product.price == null ? 'Request quotation' : formatCurrency(product.price)}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                {purchaseCaption(purchase)}
                {purchase.rfq ? ` · quote minimum ${product.moq || 1}` : ''}
              </p>
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-4">
              {purchase.buy ? (
                <AddToCartButton
                  cartKey={PORTAL_CART_KEY}
                  surface={tenant ? 'microsite' : 'portal'}
                  maxQuantity={purchase.maxBuyQty}
                  product={{
                    id: product.id,
                    sku: product.sku,
                    name: product.name,
                    price: product.price,
                    image_url: product.image_url,
                  }}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#806A50] px-4 text-sm font-semibold text-white hover:bg-[#9C8567]"
                />
              ) : null}
              {purchase.rfq ? (
                <RequestQuoteButton
                  product={shortlistProduct}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-4 text-sm font-semibold text-[#806A50] hover:bg-[#FAF7F2]"
                />
              ) : null}
              <CatalogueShortlistButton variant="detail" product={shortlistProduct} />
              <p className="text-xs text-gray-500">
                Buy places an order at the price shown. Request quote adds this gift to your shortlist and opens a requirement for your account manager.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
