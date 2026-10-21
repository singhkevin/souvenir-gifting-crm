import type { Metadata } from 'next'
import Link from 'next/link'
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
      <div className="border-b border-[#3A3835] bg-[#1C1B1A] text-[#FCF9F2]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-xs uppercase tracking-wider text-[#FFB690]">
            <Link href="/home" className="hover:underline">
              Home
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <Link href="/collections" className="hover:underline">
              Collections
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <span className="text-[#FCF9F2]">{collection.title}</span>
          </p>
          <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#FFB690]">{collection.kicker}</p>
              <h1 className="mt-1 font-serif text-3xl font-normal tracking-tight text-[#FCF9F2] sm:text-4xl lg:text-5xl">
                {collection.title}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#CCC5BD]">{collection.description}</p>
            </div>
            <div className="font-sans text-xs uppercase tracking-wider text-[#CCC5BD] shrink-0 border border-[#3A3835] bg-[#242220] px-3.5 py-2">
              SHOWING {products.length} {products.length === 1 ? 'GIFT' : 'GIFTS'}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <CatalogueBrowser products={products} />
      </div>
    </SiteShell>
  )
}
