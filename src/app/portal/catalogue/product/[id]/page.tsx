import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { CatalogueShortlistButton } from '@/components/portal/catalogue-shortlist-button'

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
  const { data: product } = await supabase
    .from('client_products')
    .select('id, name, sku, description, image_url, price, moq, category_name, brand_name')
    .eq('id', id)
    .maybeSingle()

  if (!product) notFound()

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
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(product.price)}</p>
              <p className="mt-0.5 text-xs text-gray-400">Minimum order {product.moq || 1} units</p>
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-4">
              <CatalogueShortlistButton
                variant="detail"
                product={{
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  price: product.price,
                  image_url: product.image_url,
                  category_name: product.category_name,
                }}
              />
              <Link
                href="/portal/requirements/new"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-4 text-sm font-semibold text-[#1A3022] hover:bg-[#FAF7F2]"
              >
                Create requirement
              </Link>
              <p className="text-xs text-gray-500">
                Shortlist gifts you like, then share a requirement so your account manager can prepare a quotation with branding and packaging options.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
