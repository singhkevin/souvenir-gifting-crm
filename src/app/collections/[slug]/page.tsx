import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { CatalogueBrowser } from '@/components/site/catalogue-browser'
import { collectionBySlug, productsInCollection } from '@/lib/catalogue/collections'
import { getPublicCatalogueProducts } from '@/lib/catalogue/products'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const collection = collectionBySlug(slug)
  return {
    title: collection?.title || 'Collection',
    description: collection?.description || 'A Souvenir Gifting Solutions catalogue collection.',
  }
}

export default async function CollectionDetailPage({ params }: Props) {
  const { slug } = await params
  const collection = collectionBySlug(slug)
  if (!collection) notFound()
  const products = productsInCollection(await getPublicCatalogueProducts(), slug)

  return (
    <SiteShell>
      <div className="border-b border-[#E8E4DE] bg-[#F6F4F1]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="store-eyebrow">{collection.kicker}</p>
          <h1 className="store-section-title mt-2">{collection.title}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#5C6570]">{collection.description}</p>
          <p className="mt-4 text-xs text-[#5C6570]">
            {products.length} {products.length === 1 ? 'gift' : 'gifts'}
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <CatalogueBrowser products={products} />
      </div>
    </SiteShell>
  )
}
