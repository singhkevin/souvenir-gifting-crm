import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { StorePageHeader } from '@/components/site/store-ui'
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
      <StorePageHeader
        eyebrow="Brand"
        title={brand.name}
        lede={`${owned.length} ${owned.length === 1 ? 'gift' : 'gifts'} in this brand.`}
      />
      <StorefrontCatalog
        products={products}
        categories={categories}
        brands={brands}
        filters={filters}
        basePath={`/brands/${brandPublicSlug(brand, brands)}`}
        heading={`${brand.name} catalogue`}
        intro="Every gift in this brand. Filter by category, price and occasion."
        priceOf={(product) => product.price}
        brandMode="page"
        tone="retail"
      />
    </SiteShell>
  )
}
