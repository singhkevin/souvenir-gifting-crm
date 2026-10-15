import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { RetailHero } from '@/components/site/retail-hero'
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
  const loaded = await getPublicCatalogueProducts()
  const preview = process.env.STOREFRONT_UI_PREVIEW === '1' && loaded.length === 0
  const products = loaded
  const loadedBrands = await getPublicBrands()
  const brands = preview
    ? [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Souvenir', logo_url: '/logo.png' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Field', logo_url: null },
      ]
    : loadedBrands
  const categories = await getPublicCategories()

  const heroSlides = retailHeroSlides(products).map((slide) =>
    slide.map((product) => ({ id: product.id, name: product.name, image_url: product.image_url })),
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
    <div className="bg-[#fff8f4] text-[#221a10]">
      <RetailHero slides={heroSlides} />

      <RetailOccasionBento products={products} priceOf={storePrice} />

      <ProductSection
        eyebrow="Most loved"
        title="Bestsellers"
        actionHref="/catalogue?sort=newest"
        action="View all"
        products={bestsellers}
        priceOf={storePrice}
        columns="lg:grid-cols-5"
        tone="retail"
      />

      <BrandLogoRow brands={brands} eyebrow="Shop by brand" title="Brands" tone="retail" />

      <ProductSection
        eyebrow="Everyday"
        title="Gifts under ₹999"
        actionHref="/catalogue?priceMax=998"
        action="View all"
        products={underRail}
        priceOf={storePrice}
        columns="lg:grid-cols-6"
        tone="retail"
      />

      <ProductSection
        eyebrow="Seasonal"
        title="Festive hampers"
        actionHref="/collections/festival-gifting"
        action="View all"
        products={festive}
        priceOf={storePrice}
        dark
        columns="lg:grid-cols-4"
        tone="retail"
      />

      <StorefrontCatalog
        products={products}
        categories={categories}
        brands={brands}
        filters={filters}
        basePath={basePath}
        heading="Shop the catalogue"
        intro="Filter by category, brand, price and occasion."
        priceOf={storePrice}
        limit={8}
        tone="retail"
      />

      {preview ? (
        <section className="bg-[#fff8f4] py-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
            <p className="text-sm text-[#4d453e]">In stock</p>
            <AddToCartButton
              maxQuantity={4}
              label="Add to cart"
              product={{ id: '33333333-3333-4333-8333-333333333333', sku: 'BTL-1', name: 'Steel bottle', price: 450, image_url: '/site/home-festive-cane.webp' }}
              className="inline-flex bg-[#382c1e] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
