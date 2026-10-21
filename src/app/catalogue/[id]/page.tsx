import type { Metadata } from 'next'
import { siteContent } from '@/config/siteContent'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { Breadcrumbs } from '@/components/sv2/breadcrumbs'
import { ProductImage } from '@/components/ui/product-image'
import { QuoteModal } from '@/components/site/quote-modal'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { formatCurrency, isUuid } from '@/lib/utils'
import { getPublicProduct } from '@/lib/catalogue/products'
import { purchaseCaption } from '@/lib/catalogue/purchase-path'
import { shopModeFromCookie, SHOP_MODE_COOKIE } from '@/lib/catalogue/storefront'
import { appName } from '@/lib/brand'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return { title: 'Product' }
  const product = await getPublicProduct(id)
  if (!product) return { title: 'Product' }
  return {
    title: product.name,
    description: product.description || `${product.name} — ${appName()} corporate gifting catalogue.`,
    openGraph: {
      title: `${product.name} · ${appName()}`,
      description: product.description || `Corporate gifting from ${appName()}.`,
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
      maxQuantity={1}
      label="Buy 1 sample"
      product={{
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
      }}
      className={`inline-flex justify-center px-8 py-3.5 sv2-label text-[11px] tracking-wider transition-colors duration-150 ${
        corporate
          ? 'border border-[#CCC5BD] bg-[#FCF9F2] text-[#1C1C18] hover:border-[#000000]'
          : 'bg-[#9E4300] hover:bg-[#853700] text-white'
      }`}
    />
  ) : null

  const quote = product.purchase.rfq ? (
    <QuoteModal
      productId={product.id}
      productName={product.name}
      triggerClassName={`inline-flex justify-center px-8 py-3.5 sv2-label text-[11px] tracking-wider transition-colors duration-150 ${
        corporate || !product.purchase.buy
          ? 'bg-[#000000] hover:bg-[#9E4300] text-white'
          : 'border border-[#000000] text-[#1C1C18] hover:bg-[#000000] hover:text-white'
      }`}
    >
      Request a Quote
    </QuoteModal>
  ) : null

  return (
    <SiteShell>
      {/* Breadcrumb strip */}
      <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-4 py-3 sm:px-6 lg:px-16">
        <Breadcrumbs
          className="mx-auto max-w-7xl"
          items={[
            { label: 'Home', href: '/home' },
            { label: 'Catalogue', href: '/catalogue' },
            ...(product.category_name ? [{ label: product.category_name }] : []),
            { label: product.name },
          ]}
        />
      </div>

      <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-16 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          {/* Left Column: Image Stage & Craft Perks */}
          <div className="lg:col-span-7 space-y-6">
            <div className="relative aspect-square overflow-hidden border border-[#CCC5BD] bg-[#F1EEE7]">
              <ProductImage
                src={product.image_url}
                alt={product.name}
                size="hero"
                fit="contain"
                fadeEdges
                className="h-full w-full min-h-[18rem] sm:min-h-[26rem] bg-transparent"
                imgClassName="catalogue-product-img sv2-img-zoom"
              />
              <span className="absolute top-3 left-3 bg-[#FCF9F2] text-[#1C1C18] border border-[#CCC5BD] px-2.5 py-1 sv2-label text-[10px] font-semibold">
                {product.purchase.buy ? 'In Stock • Ready to Ship' : 'Available on Quote'}
              </span>
            </div>

            {/* 3-Up Gifting Perks strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#CCC5BD] bg-[#F6F3EC] divide-y sm:divide-y-0 sm:divide-x divide-[#CCC5BD]">
              <div className="p-4 space-y-1">
                <span className="sv2-label text-[10px] text-[#9E4300] block">Gift packaging</span>
                <p className="sv2-body-sm text-xs text-[#4A4640]">{siteContent.retail.packagingNote}</p>
              </div>
              <div className="p-4 space-y-1">
                <span className="sv2-label text-[10px] text-[#9E4300] block">Delivery</span>
                <p className="sv2-body-sm text-xs text-[#4A4640]">{siteContent.retail.dispatchCities}</p>
              </div>
              <div className="p-4 space-y-1">
                <span className="sv2-label text-[10px] text-[#9E4300] block">Direct gifting</span>
                <p className="sv2-body-sm text-xs text-[#4A4640]">{siteContent.retail.directDispatchNote}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Title, Price, Specs & Actions */}
          <div className="lg:col-span-5 space-y-6">
            {/* Title & Kicker */}
            <div>
              <div className="font-sans text-xs uppercase tracking-wider font-semibold text-[#9E4300] mb-2">
                {product.category_name || 'Gift Selection'}
              </div>
              <h1 className="font-serif sv2-headline-lg text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.1] font-normal text-[#1C1C18] tracking-tight">
                {product.name}
              </h1>
              {product.brand_name ? (
                <p className="mt-2 sv2-body-sm text-[#7C766F]">Brand: <strong className="text-[#1C1C18] font-medium">{product.brand_name}</strong></p>
              ) : null}
            </div>

            {/* Price & Taxation Box */}
            <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-5 space-y-1.5">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="sv2-mono-lg text-3xl font-bold text-[#1C1C18]">
                    {product.price == null ? 'Price on quote' : formatCurrency(product.price)}
                  </span>
                </div>
                {product.purchase.buy ? (
                  <span className="border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-0.5 font-sans text-[10px] text-[#4A4640] font-semibold uppercase">
                    Standard Delivery
                  </span>
                ) : null}
              </div>
              <p className="sv2-mono-sm text-[11px] text-[#4A4640]">
                {purchaseCaption(product.purchase)}
              </p>
              {product.purchase.rfq ? (
                <p className="sv2-mono-sm text-[11px] text-[#7C766F]">
                  Quotation minimum: {product.moq || 1} units
                </p>
              ) : null}
            </div>

            {/* Description */}
            <div className="sv2-body-md text-[#4A4640] leading-relaxed">
              <p>
                {product.description ||
                  'Share a requirement and we will prepare a quotation with branding and packaging options.'}
              </p>
            </div>

            {/* Specifications Dossier Table */}
            <div className="border border-[#CCC5BD] bg-[#FCF9F2]">
              <div className="p-3 bg-[#F6F3EC] border-b border-[#CCC5BD] sv2-label text-[10px] text-[#1C1C18]">
                Product Specifications
              </div>
              <dl className="divide-y divide-[#CCC5BD] sv2-body-sm text-xs">
                <div className="flex justify-between p-3">
                  <dt className="text-[#7C766F]">SKU</dt>
                  <dd className="sv2-mono-sm font-semibold text-[#1C1C18]">{product.sku}</dd>
                </div>
                <div className="flex justify-between p-3">
                  <dt className="text-[#7C766F]">Availability</dt>
                  <dd className="text-[#1C1C18]">{product.purchase.buy ? 'Available to buy' : 'Available to quote'}</dd>
                </div>
                {product.category_name ? (
                  <div className="flex justify-between p-3">
                    <dt className="text-[#7C766F]">Category</dt>
                    <dd className="text-[#1C1C18]">{product.category_name}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {/* Call-to-action buttons */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row gap-3">
                {corporate ? quote : buy}
                {corporate ? buy : quote}
              </div>
              <div>
                <Link
                  href="/catalogue"
                  className="sv2-label text-[11px] text-[#9E4300] hover:underline inline-flex items-center gap-1"
                >
                  &larr; Back to catalogue
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    </SiteShell>
  )
}
