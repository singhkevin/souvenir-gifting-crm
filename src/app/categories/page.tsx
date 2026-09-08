import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { ProductImage } from '@/components/ui/product-image'
import { getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import { slugify } from '@/lib/utils'
import { PRODUCT_CATEGORY_ORDER, sortProductCategories } from '@/lib/products/categories'

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse GIFFTER gifts by category.',
}

export default async function CategoriesPage() {
  const [products, live] = await Promise.all([getPublicCatalogueProducts(), getPublicCategories()])
  const named = PRODUCT_CATEGORY_ORDER.map((name) => live.find((item) => item.name === name) || { id: name, name })
  const extra = live.filter((item) => !PRODUCT_CATEGORY_ORDER.includes(item.name as (typeof PRODUCT_CATEGORY_ORDER)[number]))
  const categories = [...named, ...sortProductCategories(extra)]

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#7A7267]">Categories</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Shop by category.</h1>
        <div className="mt-12 divide-y divide-[#E5DFD5] border-y border-[#E5DFD5]">
          {categories.map((category) => {
            const sample = products.find((product) => product.category_name === category.name)
            const count = products.filter((product) => product.category_name === category.name).length
            return (
              <Link
                key={category.name}
                href={`/categories/${slugify(category.name)}`}
                className="grid grid-cols-1 items-center gap-6 py-8 sm:grid-cols-[1fr_auto_6rem]"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[#7A7267]">Category</p>
                  <p className="mt-2 font-serif text-3xl">{category.name}</p>
                </div>
                <p className="text-xs text-[#7A7267]">{count} {count === 1 ? 'gift' : 'gifts'}</p>
                {sample ? (
                  <div className="hidden aspect-square bg-[#EDE6DB] sm:block">
                    <ProductImage
                      src={sample.image_url}
                      alt={sample.name}
                      size="sm"
                      fit="contain"
                      className="h-full w-full min-h-0 bg-[#EDE6DB]"
                      imgClassName="catalogue-product-img"
                    />
                  </div>
                ) : (
                  <div />
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </SiteShell>
  )
}
