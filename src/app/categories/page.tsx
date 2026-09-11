import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { ProductImage } from '@/components/ui/product-image'
import { getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import { slugify } from '@/lib/utils'
import { PRODUCT_CATEGORY_ORDER, sortProductCategories } from '@/lib/products/categories'

export const metadata: Metadata = {
  title: 'Categories',
  description: 'Browse Souvenir Gifting Solutions gifts by category.',
}

export default async function CategoriesPage() {
  const [products, live] = await Promise.all([getPublicCatalogueProducts(), getPublicCategories()])
  const named = PRODUCT_CATEGORY_ORDER.map((name) => live.find((item) => item.name === name) || { id: name, name })
  const extra = live.filter((item) => !PRODUCT_CATEGORY_ORDER.includes(item.name as (typeof PRODUCT_CATEGORY_ORDER)[number]))
  const categories = [...named, ...sortProductCategories(extra)]

  return (
    <SiteShell>
      <div className="border-b border-[#E8E4DE] bg-[#F6F4F1]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="store-eyebrow">Shop</p>
          <h1 className="store-section-title mt-2">Shop by category</h1>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const sample = products.find((product) => product.category_name === category.name)
            const count = products.filter((product) => product.category_name === category.name).length
            return (
              <Link
                key={category.name}
                href={`/categories/${slugify(category.name)}`}
                className="group overflow-hidden rounded-md border border-[#E8E4DE] bg-white transition-shadow hover:shadow-[0_8px_24px_rgba(27,36,48,0.08)]"
              >
                <div className="aspect-[5/4] catalogue-studio-field">
                  {sample ? (
                    <ProductImage
                      src={sample.image_url}
                      alt={sample.name}
                      size="md"
                      fit="contain"
                      fadeEdges
                      className="h-full w-full bg-transparent"
                      imgClassName="catalogue-product-img scale-[1.04]"
                    />
                  ) : null}
                </div>
                <div className="border-t border-[#E8E4DE] px-5 py-4">
                  <p className="font-serif text-2xl text-[#1B2430]">{category.name}</p>
                  <p className="mt-1 text-xs text-[#5C6570]">
                    {count} {count === 1 ? 'gift' : 'gifts'}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </SiteShell>
  )
}
