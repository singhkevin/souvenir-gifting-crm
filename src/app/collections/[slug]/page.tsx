import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
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
      <div className="border-b border-cream-border bg-cream-surface">
        <div className="store-container py-10 sm:py-14">
          <p className="store-eyebrow">{collection.kicker}</p>
          <h1 className="store-section-title mt-2">{collection.title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-secondary">{collection.description}</p>
        </div>
      </div>
      <div className="store-container py-10 sm:py-14">
        <CatalogueBrowser products={products} />
      </div>
    </SiteShell>
  )
}
