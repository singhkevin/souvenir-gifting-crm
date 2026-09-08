import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/site-shell'
import { CATALOGUE_COLLECTIONS, CATALOGUE_OCCASIONS } from '@/lib/catalogue/collections'
import { getPublicCatalogueProducts } from '@/lib/catalogue/products'

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Editorial GIFFTER collections and corporate occasions, grouped from the existing catalogue.',
}

export default async function CollectionsPage() {
  const products = await getPublicCatalogueProducts()

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#7A7267]">Collections</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Curated programmes.</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#6B6358]">
          Each collection is a view over existing GIFFTER products — no separate catalogue, and no invented items.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-px bg-[#E5DFD5] sm:grid-cols-2">
          {CATALOGUE_COLLECTIONS.map((collection) => {
            const count = products.filter(collection.match).length
            return (
              <Link
                key={collection.slug}
                href={`/collections/${collection.slug}`}
                className="bg-[#F4EFE6] px-8 py-10 hover:bg-[#FAF7F2]"
              >
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#7A7267]">{collection.kicker}</p>
                <p className="mt-3 font-serif text-2xl">{collection.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-[#6B6358]">{collection.description}</p>
                <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-[#7A7267]">{count} gifts</p>
              </Link>
            )
          })}
        </div>

        <section id="occasions" className="scroll-mt-24 border-t border-[#E5DFD5] pt-16 mt-16">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#7A7267]">Shop by occasion</p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">Corporate moments.</h2>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CATALOGUE_OCCASIONS.map((occasion) => (
              <Link
                key={occasion.slug}
                href={occasion.href}
                className="border border-[#E5DFD5] bg-[#FAF7F2] px-5 py-6 transition-colors hover:border-[#1A3022]"
              >
                <p className="font-serif text-xl text-[#1C1917]">{occasion.title}</p>
                <p className="mt-2 text-sm text-[#6B6358]">{occasion.line}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
