import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandName } from '@/components/brand/brand-name'
import { SiteShell } from '@/components/site/site-shell'
import { CATALOGUE_COLLECTIONS, CATALOGUE_OCCASIONS } from '@/lib/catalogue/collections'

const ARROW = '\u2192'

export const metadata: Metadata = {
  title: 'Collections',
  description: 'Editorial Souvenir - Gifting Solutions collections and corporate occasions, grouped from the existing catalogue.',
}

export default function CollectionsPage() {
  return (
    <SiteShell>
      <div className="border-b border-[#E8E4DE] bg-[#F6F4F1]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="store-eyebrow">Collections</p>
          <h1 className="store-section-title mt-2">Curated programmes</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#5C6570]">
            Each collection is a view over existing <BrandName /> products — no separate catalogue, and no invented items.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CATALOGUE_COLLECTIONS.map((collection) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="rounded-md border border-[#E8E4DE] bg-white px-6 py-8 transition-shadow hover:shadow-[0_8px_24px_rgba(27,36,48,0.08)]"
            >
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#5C6570]">{collection.kicker}</p>
              <p className="mt-3 font-serif text-2xl text-[#1B2430]">{collection.title}</p>
              <p className="mt-3 text-sm leading-relaxed text-[#5C6570]">{collection.description}</p>
              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#806A50]">
                Explore {ARROW}
              </p>
            </Link>
          ))}
        </div>

        <section id="occasions" className="mt-16 scroll-mt-28 border-t border-[#E8E4DE] pt-14">
          <p className="store-eyebrow">Shop by occasion</p>
          <h2 className="store-section-title mt-2">Corporate moments</h2>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CATALOGUE_OCCASIONS.map((occasion) => (
              <Link
                key={occasion.slug}
                href={occasion.href}
                className="rounded-md border border-[#E8E4DE] bg-[#F6F4F1] px-5 py-6 transition-colors hover:border-[#806A50] hover:bg-white"
              >
                <p className="font-serif text-xl text-[#1B2430]">{occasion.title}</p>
                <p className="mt-2 text-sm text-[#5C6570]">{occasion.line}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
