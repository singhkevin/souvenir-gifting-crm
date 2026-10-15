import type { Metadata } from 'next'
import { BrandName } from '@/components/brand/brand-name'
import { SiteShell } from '@/components/site/site-shell'
import { OverlayCard, StorePageHeader, StoreSectionHeading } from '@/components/site/store-ui'
import { CATALOGUE_COLLECTIONS, CATALOGUE_OCCASIONS, productsInCollection } from '@/lib/catalogue/collections'
import { getPublicCatalogueProducts } from '@/lib/catalogue/products'
import { appName } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Collections',
  description: `Editorial ${appName()} collections and occasions, grouped from the existing catalogue.`,
}

export default async function CollectionsPage() {
  const products = await getPublicCatalogueProducts()
  const cover = (slug: string) => productsInCollection(products, slug).find((product) => product.image_url)?.image_url

  return (
    <SiteShell>
      <StorePageHeader
        eyebrow="Collections"
        title="Gifts for every occasion"
        lede={<>Each collection is a view over existing <BrandName /> gifts.</>}
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOGUE_COLLECTIONS.map((collection) => (
            <OverlayCard
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              image={cover(collection.slug)}
              eyebrow={collection.kicker}
              title={collection.title}
              subtitle={collection.description}
              meta="Explore →"
            />
          ))}
        </div>

        <section id="occasions" className="mt-16 scroll-mt-28 border-t border-[#eadfd4] pt-14">
          <StoreSectionHeading eyebrow="Shop by occasion" title="Gifts for every occasion" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATALOGUE_OCCASIONS.map((occasion) => {
              const slug = occasion.href.split('/').pop() || ''
              return (
                <OverlayCard
                  key={occasion.slug}
                  href={occasion.href}
                  image={cover(slug)}
                  title={occasion.title}
                  subtitle={occasion.line}
                  meta="Explore →"
                />
              )
            })}
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
