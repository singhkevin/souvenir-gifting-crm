import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { optimisedImageSrc } from '@/components/ui/optimised-src'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { StorefrontCatalog } from '@/components/site/storefront-catalog'
import { readCatalogueFilters } from '@/lib/catalogue/catalogue-query'
import { getPublicBrands, getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import { brandByPublicSlug, brandPublicSlug } from '@/lib/catalogue/store-nav'
import { appName } from '@/lib/brand'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const brands = await getPublicBrands()
  const brand = brandByPublicSlug(slug, brands)
  const name = brand?.name || 'Brand'
  return {
    title: name,
    description: `${name} gifts from the ${appName()} catalogue.`,
  }
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params
  const query = await searchParams
  const [products, brands, categories] = await Promise.all([
    getPublicCatalogueProducts(),
    getPublicBrands(),
    getPublicCategories(),
  ])
  const brand = brandByPublicSlug(slug, brands)
  if (!brand) notFound()
  const filters = { ...readCatalogueFilters(query), brand: brand.id }
  const owned = products.filter((product) => product.brand_id === brand.id)

  return (
    <SiteShell>
      <div className="border-b border-[#3A3835] bg-[#1C1B1A] text-[#FCF9F2]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-xs uppercase tracking-wider text-[#FFB690]">
            <Link href="/home" className="hover:underline">
              Home
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <Link href="/catalogue" className="hover:underline">
              Brands
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <span className="text-[#FCF9F2]">{brand.name}</span>
          </p>
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {brand.logo_url ? (
                <div className="flex h-16 w-16 items-center justify-center border border-[#3A3835] bg-[#FCF9F2] p-2">
                  {optimisedImageSrc(brand.logo_url) ? (
                    <Image
                      src={brand.logo_url}
                      alt={brand.name}
                      width={48}
                      height={48}
                      quality={90}
                      className="max-h-full max-w-full object-contain"
                      style={{ width: 'auto', height: 'auto' }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo_url} alt={brand.name} className="max-h-full max-w-full object-contain" />
                  )}
                </div>
              ) : null}
              <div>
                <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#FFB690]">PARTNER BRAND</p>
                <h1 className="mt-1 font-serif text-3xl font-normal tracking-tight text-[#FCF9F2] sm:text-4xl lg:text-5xl">
                  {brand.name}
                </h1>
                <p className="mt-2 font-sans text-xs text-[#CCC5BD]">
                  {owned.length} {owned.length === 1 ? 'gift' : 'gifts'} from this brand
                </p>
              </div>
            </div>
            <div className="font-sans text-xs uppercase tracking-wider text-[#CCC5BD] shrink-0 border border-[#3A3835] bg-[#242220] px-3.5 py-2">
              VERIFIED BRAND ALLIANCE
            </div>
          </div>
        </div>
      </div>
      <StorefrontCatalog
        products={products}
        categories={categories}
        brands={brands}
        filters={filters}
        basePath={`/brands/${brandPublicSlug(brand, brands)}`}
        heading={`${brand.name} catalogue`}
        intro="Every product in this brand. Filter by category, price and occasion."
        priceOf={(product) => product.price}
        brandMode="page"
      />
    </SiteShell>
  )
}
