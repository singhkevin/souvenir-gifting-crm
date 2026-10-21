import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandName } from '@/components/brand/brand-name'
import { SiteShell } from '@/components/site/site-shell'
import { CATALOGUE_COLLECTIONS, CATALOGUE_OCCASIONS } from '@/lib/catalogue/collections'
import { appName } from '@/lib/brand'

const ARROW = '\u2192'

export const metadata: Metadata = {
  title: 'Collections',
  description: `Editorial ${appName()} collections and corporate occasions, grouped from the existing catalogue.`,
}

export default function CollectionsPage() {
  return (
    <SiteShell>
      <div className="border-b border-[#3A3835] bg-[#1C1B1A] text-[#FCF9F2]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-xs uppercase tracking-wider text-[#FFB690]">
            <Link href="/home" className="hover:underline">
              Home
            </Link>
            <span className="mx-2 text-[#7C766F]">/</span>
            <span className="text-[#FCF9F2]">Collections</span>
          </p>
          <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="font-serif text-3xl font-normal tracking-tight text-[#FCF9F2] sm:text-4xl lg:text-5xl">
                Gift programmes
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#CCC5BD]">
                Each collection is a view over the live <BrandName /> catalogue — verified gifts ready for custom branding and nationwide delivery.
              </p>
            </div>
            <div className="font-sans text-xs uppercase tracking-wider text-[#CCC5BD] shrink-0 border border-[#3A3835] bg-[#242220] px-3.5 py-2">
              VERIFIED PROGRAMMES
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {CATALOGUE_COLLECTIONS.map((collection) => (
            <Link
              key={collection.slug}
              href={`/collections/${collection.slug}`}
              className="group flex flex-col justify-between border border-[#CCC5BD] bg-[#FCF9F2] p-8 transition-colors hover:border-[#1C1B1A]"
            >
              <div>
                <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#9E4300]">
                  {collection.kicker}
                </p>
                <p className="mt-3 font-serif text-2xl sm:text-3xl text-[#1C1B1A] group-hover:text-[#9E4300] transition-colors">
                  {collection.title}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#4A4640]">{collection.description}</p>
              </div>
              <p className="mt-8 font-sans text-xs font-semibold uppercase tracking-wider text-[#1C1B1A] group-hover:text-[#9E4300] transition-colors">
                Explore collection {ARROW}
              </p>
            </Link>
          ))}
        </div>

        <section id="occasions" className="mt-16 scroll-mt-28 border-t border-[#CCC5BD] pt-14">
          <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#9E4300]">Shop by occasion</p>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl text-[#1C1B1A]">Corporate moments</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATALOGUE_OCCASIONS.map((occasion) => (
              <Link
                key={occasion.slug}
                href={occasion.href}
                className="group border border-[#CCC5BD] bg-[#F6F3EC] p-6 transition-colors hover:border-[#1C1B1A] hover:bg-[#FCF9F2]"
              >
                <p className="font-serif text-xl text-[#1C1B1A] group-hover:text-[#9E4300] transition-colors">
                  {occasion.title}
                </p>
                <p className="mt-2 text-sm text-[#4A4640]">{occasion.line}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </SiteShell>
  )
}
