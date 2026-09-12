import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { CatalogueBrowser } from '@/components/site/catalogue-browser'
import { getPublicCatalogueProducts } from '@/lib/catalogue/products'
import { PRODUCT_CATEGORY_ORDER } from '@/lib/products/categories'
import { slugify } from '@/lib/utils'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const products = await getPublicCatalogueProducts()
  const name =
    [...PRODUCT_CATEGORY_ORDER, ...products.map((p) => p.category_name || '')].find((item) => slugify(item) === slug) ||
    'Category'
  return { title: name, description: `${name} gifts from the Souvenir - Gifting Solutions catalogue.` }
}

export default async function CategoryDetailPage({ params }: Props) {
  const { slug } = await params
  const products = await getPublicCatalogueProducts()
  const names = Array.from(new Set([...PRODUCT_CATEGORY_ORDER, ...products.map((p) => p.category_name || '')])).filter(
    Boolean,
  )
  const name = names.find((item) => slugify(item) === slug)
  if (!name) notFound()
  const filtered = products.filter((product) => product.category_name === name)

  return (
    <SiteShell>
      <div className="border-b border-[#E8E4DE] bg-[#F6F4F1]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="store-eyebrow">Category</p>
          <h1 className="store-section-title mt-2">{name}</h1>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <CatalogueBrowser products={filtered} />
      </div>
    </SiteShell>
  )
}
