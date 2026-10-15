import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { ProductImage } from '@/components/ui/product-image'
import { QuoteModal } from '@/components/site/quote-modal'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { RetailBuyActions } from '@/components/site/retail-buy'
import { formatCurrency, isUuid } from '@/lib/utils'
import { getPublicProduct } from '@/lib/catalogue/products'
import { shopModeFromCookie, SHOP_MODE_COOKIE, retailStatusLabel } from '@/lib/catalogue/storefront'
import { appName } from '@/lib/brand'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return { title: 'Product' }
  const product = await getPublicProduct(id)
  if (!product) return { title: 'Product' }
  return {
    title: product.name,
    description: product.description || `${product.name} from the ${appName()} gift catalogue.`,
    openGraph: {
      title: `${product.name} · ${appName()}`,
      description: product.description || `${product.name} from ${appName()}.`,
      siteName: appName(),
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
  }
}

export default async function PublicProductPage({ params }: Props) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const product = await getPublicProduct(id)
  if (!product) notFound()
  const jar = await cookies()
  const corporate = shopModeFromCookie(jar.get(SHOP_MODE_COOKIE)?.value) === 'corporate'
  const buy = product.purchase.buy ? (
    <AddToCartButton
      maxQuantity={product.purchase.maxBuyQty}
      label="Add to cart"
      product={{
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
      }}
      className="inline-flex justify-center border border-[#E5DFD5] px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#806A50] hover:bg-[#FAF7F2] sm:py-3"
    />
  ) : null
  const quote = product.purchase.rfq ? (
    <QuoteModal
      productId={product.id}
      productName={product.name}
      triggerClassName={`inline-flex justify-center px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] sm:py-3 ${
        corporate || !product.purchase.buy
          ? 'bg-[#806A50] text-white hover:bg-[#9C8567]'
          : 'border border-[#E5DFD5] text-[#806A50] hover:bg-[#FAF7F2]'
      }`}
    >
      Request a Quote
    </QuoteModal>
  ) : null

  return (
    <SiteShell>
      <article className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-16">
        <div className="overflow-hidden rounded-md catalogue-studio-field">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="hero"
            fit="contain"
            fadeEdges
            className="min-h-[16rem] h-full aspect-square bg-transparent sm:min-h-[22rem]"
            imgClassName="catalogue-product-img scale-[1.04]"
          />
        </div>
        <div className="lg:py-4">
          {product.category_name ? (
            <p className="store-eyebrow">{product.category_name}</p>
          ) : null}
          <h1 className="store-section-title mt-3">{product.name}</h1>
          {product.brand_name ? <p className="mt-3 text-sm text-[#4d453e]">{product.brand_name}</p> : null}
          <p className="mt-6 text-2xl font-semibold text-[#22180b]">
            {product.price == null ? (corporate ? 'Price on quote' : '—') : formatCurrency(product.price)}
          </p>
          <p className="mt-2 text-xs text-[#4d453e]">
            {corporate
              ? product.purchase.rfq
                ? `Quote from ${product.moq || 1} units`
                : retailStatusLabel(product.purchase)
              : retailStatusLabel(product.purchase)}
          </p>

          <p className="mt-8 max-w-md text-sm leading-7 text-[#4d453e]">
            {product.description ||
              (corporate
                ? 'Add this gift to a quote, or buy what is in stock.'
                : 'A gift from the catalogue, ready to order.')}
          </p>

          <dl className="mt-10 space-y-3 text-sm">
            <div className="flex justify-between border-b border-[#eadfd4] py-2">
              <dt className="text-[#4d453e]">SKU</dt>
              <dd className="font-mono text-xs">{product.sku}</dd>
            </div>
            <div className="flex justify-between border-b border-[#eadfd4] py-2">
              <dt className="text-[#4d453e]">Availability</dt>
              <dd>
                {corporate
                  ? product.purchase.buy
                    ? 'Available to buy'
                    : product.purchase.rfq
                      ? 'Available to quote'
                      : retailStatusLabel(product.purchase)
                  : retailStatusLabel(product.purchase)}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center sm:gap-4">
            {corporate ? (
              <>
                {quote}
                {buy}
              </>
            ) : (
              <RetailBuyActions
                layout="row"
                product={{
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  price: product.price,
                  image_url: product.image_url,
                  purchase: product.purchase,
                }}
              />
            )}
            <Link
              href="/catalogue"
              className="inline-flex justify-center py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#735c00]"
            >
              Back to catalogue
            </Link>
          </div>
        </div>
      </article>
    </SiteShell>
  )
}
