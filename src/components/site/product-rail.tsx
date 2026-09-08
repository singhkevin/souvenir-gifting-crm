'use client'

import { SiteProductCard } from '@/components/site/site-product-card'
import type { PublicProduct } from '@/lib/catalogue/products'

export function ProductRail({ products }: { products: PublicProduct[] }) {
  if (!products.length) return null

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex w-max gap-3 sm:gap-5">
        {products.map((product) => (
          <div key={product.id} className="w-[40vw] max-w-[200px] shrink-0 sm:w-[200px] lg:w-[210px]">
            <SiteProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  )
}
