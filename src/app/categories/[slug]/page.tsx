import type { Metadata } from 'next'
import Link from 'next/link'
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
      <div className="border-b border-[#3A3835] bg-[#1C1B1A] text-[#FCF9F2]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-xs uppercase tracking-wider text-[#FFB690]">
            <Link href="/home" className="hover:underline">
              Home
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <Link href="/categories" className="hover:underline">
              Categories
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <span className="text-[#FCF9F2]">{name}</span>
          </p>
          <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-serif text-3xl font-normal tracking-tight text-[#FCF9F2] sm:text-4xl lg:text-5xl">
                {name}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#CCC5BD]">
                Showing {filtered.length} {filtered.length === 1 ? 'gift' : 'gifts'} in this category.
              </p>
            </div>
            <div className="font-sans text-xs uppercase tracking-wider text-[#CCC5BD] shrink-0 border border-[#3A3835] bg-[#242220] px-3.5 py-2">
              CATEGORY VIEW
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <CatalogueBrowser products={filtered} />
      </div>
    </SiteShell>
  )
}
