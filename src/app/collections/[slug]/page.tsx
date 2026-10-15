import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { StorePageHeader } from '@/components/site/store-ui'
import { CatalogueBrowser } from '@/components/site/catalogue-browser'
import { collectionBySlug, productsInCollection } from '@/lib/catalogue/collections'
import { getPublicCatalogueProducts } from '@/lib/catalogue/products'
import { appName } from '@/lib/brand'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const collection = collectionBySlug(slug)
  return {
    title: collection?.title || 'Collection',
    description: collection?.description || `A ${appName()} catalogue collection.`,
  }
}

export default async function CollectionDetailPage({ params }: Props) {
  const { slug } = await params
  const collection = collectionBySlug(slug)
  if (!collection) notFound()
  const products = productsInCollection(await getPublicCatalogueProducts(), slug)

  return (
    <SiteShell>
      <StorePageHeader eyebrow={collection.kicker} title={collection.title} lede={collection.description} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <CatalogueBrowser products={products} />
      </div>
    </SiteShell>
  )
}
