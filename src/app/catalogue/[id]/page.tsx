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
    description: product.description || `${product.name} — GIFFTER corporate gifting catalogue.`,
    openGraph: {
      title: `${product.name} · GIFFTER`,
      description: product.description || 'Corporate gifting from GIFFTER.',
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
      <article className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-2 lg:py-20">
        <div className="bg-[#FAF7F2]">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="hero"
            fit="cover"
            className="min-h-[22rem] h-full"
          />
        </div>
        <div className="lg:py-6">
          {product.category_name && (
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#7A7267]">{product.category_name}</p>
          )}
          <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">{product.name}</h1>
          {product.brand_name && <p className="mt-3 text-sm text-[#6B6358]">{product.brand_name}</p>}
          <p className="mt-6 text-2xl text-[#1A3022]">{formatCurrency(product.price)}</p>
          <p className="mt-2 text-xs text-[#7A7267]">Minimum order {product.moq || 1} units</p>

          <p className="mt-8 max-w-md text-sm leading-relaxed text-[#5A5248]">
            {product.description ||
              'Share a requirement and we will prepare a quotation with branding and packaging options.'}
          </p>

          <dl className="mt-10 space-y-3 text-sm">
            <div className="flex justify-between border-b border-[#E5DFD5] py-2">
              <dt className="text-[#7A7267]">SKU</dt>
              <dd className="font-mono text-xs">{product.sku}</dd>
            </div>
            <div className="flex justify-between border-b border-[#E5DFD5] py-2">
              <dt className="text-[#7A7267]">Availability</dt>
              <dd className="capitalize">{product.status === 'active' ? 'Available to quote' : product.status}</dd>
            </div>
          </dl>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href={quoteHref}
              className="inline-flex justify-center bg-[#1A3022] px-7 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#FAF7F2]"
            >
              Request a Quote
            </Link>
            <Link href={quoteHref} className="text-[11px] uppercase tracking-[0.16em] text-[#1A3022]">
              Enquire about this product
            </Link>
          </div>
        </div>
      </article>
    </SiteShell>
  )
}
