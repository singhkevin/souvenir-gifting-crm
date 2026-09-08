'use client'

import { SiteProductCard } from '@/components/site/site-product-card'
import type { PublicProduct } from '@/lib/catalogue/products'

export function ProductRail({ products }: { products: PublicProduct[] }) {
  if (!products.length) return null

  return (
    <div className="-mx-5 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] sm:-mx-8 sm:px-8">
      <div className="flex w-max gap-4 sm:gap-5">
        {products.map((product) => (
          <div key={product.id} className="w-[42vw] max-w-[240px] shrink-0 sm:w-[220px] lg:w-[240px]">
            <SiteProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  )
}
