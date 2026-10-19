import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { CatalogueBrowser } from '@/components/site/catalogue-browser'
import { getPublicCatalogueProducts } from '@/lib/catalogue/products'
import { PRODUCT_CATEGORY_ORDER } from '@/lib/products/categories'
import { slugify } from '@/lib/utils'
import { appName } from '@/lib/brand'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const products = await getPublicCatalogueProducts()
  const name =
    [...PRODUCT_CATEGORY_ORDER, ...products.map((p) => p.category_name || '')].find((item) => slugify(item) === slug) ||
    'Category'
  return { title: name, description: `${name} gifts from the ${appName()} catalogue.` }
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
      <div className="border-b border-cream-border bg-cream-surface">
        <div className="store-container py-10 sm:py-14">
          <p className="store-eyebrow">Category</p>
          <h1 className="store-section-title mt-2">{name}</h1>
        </div>
      </div>
      <div className="store-container py-10 sm:py-14">
        <CatalogueBrowser products={filtered} />
      </div>
    </SiteShell>
  )
}
