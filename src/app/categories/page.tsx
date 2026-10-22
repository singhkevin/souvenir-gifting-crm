import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { ProductImage } from '@/components/ui/product-image'
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
      <div className="border-b border-[#3A3835] bg-[#1C1B1A] text-[#FCF9F2]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-xs uppercase tracking-wider text-[#FFB690]">
            <Link href="/home" className="hover:underline">
              Home
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <span className="text-[#FCF9F2]">Categories</span>
          </p>
          <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-serif text-3xl font-normal tracking-tight text-[#FCF9F2] sm:text-4xl lg:text-5xl">
                Shop by category
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#CCC5BD]">
                Explore gifts organised across core gifting categories — from executive hampers to custom stationery.
              </p>
            </div>
            <div className="font-sans text-xs uppercase tracking-wider text-[#CCC5BD] shrink-0 border border-[#3A3835] bg-[#242220] px-3.5 py-2">
              ALL CATEGORIES
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const sample = products.find((product) => product.category_name === category.name)
            const count = products.filter((product) => product.category_name === category.name).length
            return (
              <Link
                key={category.name}
                href={`/categories/${slugify(category.name)}`}
                className="group flex flex-col justify-between border border-[#CCC5BD] bg-[#FCF9F2] transition-colors hover:border-[#1C1B1A]"
              >
                <div className="aspect-[5/4] bg-[#F1EEE7] overflow-hidden flex items-center justify-center p-6">
                  {sample ? (
                    <ProductImage
                      src={sample.image_url}
                      alt={sample.name}
                      size="md"
                      fit="contain"
                      fadeEdges
                      className="h-full w-full bg-transparent transition-transform duration-500 group-hover:scale-105"
                      imgClassName="catalogue-product-img"
                    />
                  ) : null}
                </div>
                <div className="border-t border-[#CCC5BD] p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-serif text-xl sm:text-2xl text-[#1C1B1A] group-hover:text-[#9E4300] transition-colors">
                      {category.name}
                    </p>
                    <span className="font-mono text-xs text-[#9E4300] font-semibold">
                      {count} {count === 1 ? 'gift' : 'gifts'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-sans font-semibold text-[#7C766F] uppercase tracking-wider">
                    EXPLORE CATEGORY &rarr;
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
