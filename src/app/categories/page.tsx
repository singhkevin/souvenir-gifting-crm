import type { Metadata } from 'next'
import { SiteShell } from '@/components/site/site-shell'
import { OverlayCard, StorePageHeader } from '@/components/site/store-ui'
import { getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import { slugify } from '@/lib/utils'
import { PRODUCT_CATEGORY_ORDER, sortProductCategories } from '@/lib/products/categories'
import { appName } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Categories',
  description: `Browse ${appName()} gifts by category.`,
}

export default async function CategoriesPage() {
  const [products, live] = await Promise.all([getPublicCatalogueProducts(), getPublicCategories()])
  const named = PRODUCT_CATEGORY_ORDER.map((name) => live.find((item) => item.name === name) || { id: name, name })
  const extra = live.filter((item) => !PRODUCT_CATEGORY_ORDER.includes(item.name as (typeof PRODUCT_CATEGORY_ORDER)[number]))
  const categories = [...named, ...sortProductCategories(extra)]

  return (
    <SiteShell>
      <StorePageHeader eyebrow="Shop" title="Shop by category" lede="Browse gifts by the kind of thing you are looking for." />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const sample = products.find((product) => product.category_name === category.name && product.image_url)
            const count = products.filter((product) => product.category_name === category.name).length
            return (
              <OverlayCard
                key={category.name}
                href={`/categories/${slugify(category.name)}`}
                image={sample?.image_url}
                eyebrow="Category"
                title={category.name}
                subtitle={`${count} ${count === 1 ? 'gift' : 'gifts'}`}
                meta="Explore →"
              />
            )
          })}
        </div>
      </div>
    </SiteShell>
  )
}
