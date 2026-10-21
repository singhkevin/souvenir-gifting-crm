import { RetailHero } from '@/components/site/retail-hero'
import { Reveal } from '@/components/site/reveal'
import { BrandLogoRow, ProductSection, RetailOccasionBento } from '@/components/site/stitch-sections'
import { StorefrontCatalog } from '@/components/site/storefront-catalog'
import { readCatalogueFilters } from '@/lib/catalogue/catalogue-query'
import { curateTrendingProducts, retailHeroSlides } from '@/lib/catalogue/curate'
import { getPublicBrands, getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import type { PublicProduct } from '@/lib/catalogue/products'

function storePrice(product: PublicProduct) {
  return product.price
}

function withImage(products: PublicProduct[]) {
  const pictured = products.filter((product) => product.image_url)
  return pictured.length ? pictured : products
}

export async function PublicHome({
  searchParams,
  basePath = '/home',
}: {
  searchParams?: Record<string, string | string[] | undefined>
  basePath?: string
}) {
  const filters = readCatalogueFilters(searchParams)
  const products = await getPublicCatalogueProducts()
  const brands = await getPublicBrands()
  const categories = await getPublicCategories()

  const heroSlides = retailHeroSlides(products).map((slide) =>
    slide.map((product) => ({
      id: product.id,
      name: product.name,
      image_url: product.image_url,
      price: product.price,
      sku: product.sku,
    })),
  )
  const bestsellers = withImage(curateTrendingProducts(products, 5)).slice(0, 5)
  const under999 = [...products]
    .filter((product) => product.price != null && product.price > 0 && product.price < 999)
    .sort((a, b) => (a.price || 0) - (b.price || 0))
  const underRail = withImage(under999).slice(0, 6)
  const festivePool = products.filter(
    (product) =>
      product.occasion_tags.includes('festive') ||
      product.category_name === 'Hampers & Gift Sets' ||
      /festive|diwali|hamper/i.test(product.name),
  )
  const festive = withImage(festivePool).slice(0, 4)

  return (
    <div className="bg-cream text-ink">
      <RetailHero slides={heroSlides} />

      <Reveal>
        <RetailOccasionBento products={products} priceOf={storePrice} />
      </Reveal>

      <Reveal>
        <ProductSection
          numeral="02"
          eyebrow="Most requested"
          title="Corporate bestsellers"
          actionHref="/catalogue?sort=newest"
          action="View all"
          products={bestsellers}
          priceOf={storePrice}
          columns="lg:grid-cols-4"
          tone="retail"
        />
      </Reveal>

      <Reveal>
        <BrandLogoRow numeral="03" brands={brands} eyebrow="Merchandise partners" title="Authorised brand alliances" tone="retail" />
      </Reveal>

      <Reveal>
        <ProductSection
          numeral="04"
          eyebrow="Everyday"
          title="Merchandise under ₹999"
          actionHref="/catalogue?priceMax=998"
          action="View all"
          products={underRail}
          priceOf={storePrice}
          columns="lg:grid-cols-4"
          tone="retail"
        />
      </Reveal>

      <Reveal>
        <ProductSection
          eyebrow="Seasonal"
          title="Diwali & bespoke festive hampers"
          actionHref="/collections/festival-gifting"
          action="View all"
          products={festive}
          priceOf={storePrice}
          dark
          columns="lg:grid-cols-4"
          tone="retail"
        />
      </Reveal>

      <StorefrontCatalog
        products={products}
        categories={categories}
        brands={brands}
        filters={filters}
        basePath={basePath}
        heading="Live procurement catalogue"
        intro="Filter the live catalogue by category, brand, price and occasion."
        priceOf={storePrice}
        limit={8}
        tone="retail"
      />
    </div>
  )
}
