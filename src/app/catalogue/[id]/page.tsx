import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency, isUuid } from '@/lib/utils'
import { getPublicProduct } from '@/lib/catalogue/products'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return { title: 'Product' }
  const product = await getPublicProduct(id)
  if (!product) return { title: 'Product' }
  return {
    title: product.name,
    description: product.description || `${product.name} — Souvenir - Gifting Solutions corporate gifting catalogue.`,
    openGraph: {
      title: `${product.name} · Souvenir - Gifting Solutions`,
      description: product.description || 'Corporate gifting from Souvenir - Gifting Solutions.',
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
  }
}

export default async function PublicProductPage({ params }: Props) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const product = await getPublicProduct(id)
  if (!product) notFound()

  const quoteHref = `/request-quote?product=${product.id}`

  return (
    <SiteShell>
      <article className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-16">
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
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#5C6570]">{product.category_name}</p>
          ) : null}
          <h1 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl lg:text-5xl">{product.name}</h1>
          {product.brand_name ? <p className="mt-3 text-sm text-[#5C6570]">{product.brand_name}</p> : null}
          <p className="mt-6 text-2xl font-semibold text-[#1A3022]">{formatCurrency(product.price)}</p>
          <p className="mt-2 text-xs text-[#5C6570]">Minimum order {product.moq || 1} units</p>

          <p className="mt-8 max-w-md text-sm leading-relaxed text-[#5C6570]">
            {product.description ||
              'Share a requirement and we will prepare a quotation with branding and packaging options.'}
          </p>

          <dl className="mt-10 space-y-3 text-sm">
            <div className="flex justify-between border-b border-[#E8E4DE] py-2">
              <dt className="text-[#5C6570]">SKU</dt>
              <dd className="font-mono text-xs">{product.sku}</dd>
            </div>
            <div className="flex justify-between border-b border-[#E8E4DE] py-2">
              <dt className="text-[#5C6570]">Availability</dt>
              <dd className="capitalize">{product.status === 'active' ? 'Available to quote' : product.status}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href={quoteHref}
              className="inline-flex justify-center bg-[#1A3022] px-7 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white sm:py-3"
            >
              Request a Quote
            </Link>
            <Link
              href="/catalogue"
              className="inline-flex justify-center py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1A3022]"
            >
              Back to catalogue
            </Link>
          </div>
        </div>
      </article>
    </SiteShell>
  )
}
