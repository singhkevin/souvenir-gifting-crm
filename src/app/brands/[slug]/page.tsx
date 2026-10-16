import type { Metadata } from 'next'
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
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 pt-8 sm:px-6 lg:px-8">
        {brand.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt="" className="h-12 w-auto object-contain" />
        ) : null}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#715a3e]">Brand</p>
          <h1 className="font-serif text-3xl text-[#22180b]">{brand.name}</h1>
          <p className="mt-1 text-sm text-[#4d453e]">
            {owned.length} {owned.length === 1 ? 'product' : 'products'} in this brand.
          </p>
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
