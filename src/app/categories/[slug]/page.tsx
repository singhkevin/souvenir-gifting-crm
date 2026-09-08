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
  return { title: name, description: `${name} gifts from the GIFFTER catalogue.` }
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
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#7A7267]">Category</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">{name}</h1>
        <p className="mt-8 text-xs text-[#7A7267]">{filtered.length} gifts</p>
        <div className="mt-8">
          <CatalogueBrowser products={filtered} />
        </div>
      </div>
    </SiteShell>
  )
}
