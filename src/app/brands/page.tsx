import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { StoreCard, StorePageHeader } from '@/components/site/store-ui'
import { getPublicBrands, getPublicCatalogueProducts } from '@/lib/catalogue/products'
import { brandPath } from '@/lib/catalogue/store-nav'
import { appName } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Brands',
  description: `Shop ${appName()} gifts by brand.`,
}

export default async function BrandsPage() {
  const [brands, products] = await Promise.all([getPublicBrands(), getPublicCatalogueProducts()])

  return (
    <SiteShell>
      <StorePageHeader eyebrow="Shop by brand" title="Brands" lede="Every brand in the catalogue, in one list." />
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6 sm:py-16 lg:grid-cols-4 lg:px-8">
        {brands.map((brand) => {
          const count = products.filter((product) => product.brand_id === brand.id).length
          return (
            <Link key={brand.id} href={brandPath(brand, brands)} className="block h-full">
              <StoreCard className="flex h-full flex-col items-center justify-center px-4 py-8 text-center transition hover:-translate-y-0.5 hover:border-[#d7c4a4]">
                {brand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logo_url} alt="" className="mb-3 max-h-10 w-auto object-contain" />
                ) : null}
                <p className="font-serif text-xl text-[#22180b]">{brand.name}</p>
                <p className="mt-2 text-sm font-semibold text-[#735c00]">
                  {count} {count === 1 ? 'gift' : 'gifts'} · Explore →
                </p>
              </StoreCard>
            </Link>
          )
        })}
      </div>
    </SiteShell>
  )
}
