import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { ProductImage } from '@/components/ui/product-image'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { formatCurrency, isUuid } from '@/lib/utils'
import { getPublicProduct } from '@/lib/catalogue/products'
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
  const priced = product.price != null && product.price > 0
  const enquireLabel = product.purchase.reason === 'zero-stock' ? 'Notify me' : 'Enquire for custom'

  return (
    <SiteShell>
      <article className="store-container grid gap-8 py-10 sm:gap-10 sm:py-14 lg:grid-cols-2 lg:gap-14 lg:py-16">
        <div className="overflow-hidden rounded border border-cream-border bg-cream-surface">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="hero"
            fit="contain"
            className="aspect-square h-full min-h-[16rem] bg-transparent sm:min-h-[22rem]"
          />
        </div>
        <div className="lg:py-4">
          {product.category_name ? <p className="store-eyebrow">{product.category_name}</p> : null}
          <h1 className="store-section-title mt-3">{product.name}</h1>
          {product.brand_name ? <p className="mt-3 text-sm text-ink-secondary">{product.brand_name}</p> : null}
          {priced ? <p className="store-price-lg mt-6">{formatCurrency(product.price)}</p> : null}
          {product.purchase.buy ? (
            <p className="mt-3 inline-flex border border-success bg-success-bg px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em] text-success uppercase">
              In stock
            </p>
          ) : null}

          <p className="mt-8 max-w-md text-base leading-relaxed text-ink-secondary">
            {product.description ||
              'Share a requirement and we will prepare a quotation with branding and packaging options.'}
          </p>

          <dl className="mt-10 space-y-3 text-sm">
            <div className="flex justify-between border-b border-cream-border py-2">
              <dt className="text-ink-secondary">SKU</dt>
              <dd className="font-mono text-xs tracking-[0.04em]">{product.sku}</dd>
            </div>
            <div className="flex justify-between border-b border-cream-border py-2">
              <dt className="text-ink-secondary">Availability</dt>
              <dd>{product.purchase.buy ? 'In stock' : enquireLabel}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center sm:gap-4">
            {product.purchase.buy ? (
              <AddToCartButton
                instant
                maxQuantity={product.purchase.maxBuyQty}
                label="Add to cart"
                product={{
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  price: product.price,
                  image_url: product.image_url,
                }}
                className="inline-flex min-h-12 justify-center bg-saffron px-7 text-sm font-bold text-charcoal hover:bg-saffron-hover"
              />
            ) : (
              <Link
                href={`/request-quote?product=${product.id}`}
                className="inline-flex min-h-12 items-center justify-center border border-ink px-7 text-sm font-semibold text-ink hover:bg-cream-surface"
              >
                {enquireLabel}
              </Link>
            )}
            <Link href="/catalogue" className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-ink-secondary">
              Back to catalogue
            </Link>
          </div>
          <p className="mt-6 text-sm text-ink-secondary">
            <Link href="/business" className="underline decoration-cream-border underline-offset-4 hover:text-ink">
              For Business
            </Link>
          </p>
        </div>
      </article>
    </SiteShell>
  )
}
