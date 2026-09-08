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
    description: collection?.description || 'A GIFFTER catalogue collection.',
  }
}

export default async function CollectionDetailPage({ params }: Props) {
  const { slug } = await params
  const collection = collectionBySlug(slug)
  if (!collection) notFound()
  const products = productsInCollection(await getPublicCatalogueProducts(), slug)

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#7A7267]">{collection.kicker}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">{collection.title}</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6B6358]">{collection.description}</p>
        <p className="mt-8 text-xs text-[#7A7267]">{products.length} gifts</p>
        <div className="mt-8">
          <CatalogueBrowser products={products} />
        </div>
      </div>
    </SiteShell>
  )
}
