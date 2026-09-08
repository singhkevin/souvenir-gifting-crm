'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'
import type { PublicProduct } from '@/lib/catalogue/products'

export function HeroStage({
  products,
  catalogueCount,
}: {
  products: PublicProduct[]
  catalogueCount: number
}) {
  const floats = products.slice(0, 4)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (floats.length < 2) return
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % floats.length)
    }, 4200)
    return () => window.clearInterval(timer)
  }, [floats.length])

  return (
    <section className="relative isolate min-h-[88vh] overflow-hidden bg-[#1A3022] text-[#FAF7F2]">
      <div className="absolute inset-0">
        <Image
          src="/site/hero-composition.webp"
          alt="Premium corporate gifts arranged for GIFFTER"
          fill
          priority
          sizes="100vw"
          className="object-cover scale-[1.03] animate-[giffter-drift_22s_ease-in-out_infinite] motion-reduce:animate-none"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102018]/95 via-[#1A3022]/88 to-[#1A3022]/78" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1A13]/75 via-transparent to-[#1A3022]/40" />
        <div className="absolute inset-0 bg-[#1A3022]/25" />
      </div>

      <div className="relative mx-auto grid min-h-[88vh] max-w-6xl items-end gap-10 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-24 lg:pt-32">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[#D6CEBE]/90">GIFFTER</p>
          <h1 className="mt-5 max-w-xl font-serif text-[2.8rem] leading-[1.02] tracking-tight text-[#FAF7F2] sm:text-6xl lg:text-[4.4rem]">
            Corporate gifting,
            <br />
            designed to be remembered.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-[#F0EAE0]/95">
            Thoughtfully curated gifts for teams, clients and brands.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/catalogue"
              className="bg-[#FAF7F2] px-7 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#1A3022]"
            >
              Explore Catalogue
            </Link>
            <Link
              href="/request-quote"
              className="border border-[#FAF7F2]/35 px-7 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#FAF7F2] transition-colors hover:bg-[#FAF7F2]/10"
            >
              Request a Quote
            </Link>
          </div>
          <p className="mt-8 text-xs tracking-wide text-[#FAF7F2]/90">
            {catalogueCount} gifts in the live catalogue
          </p>
        </div>

        <div className="relative hidden h-[28rem] lg:block">
          {floats.map((product, index) => {
            const positions = [
              'left-6 top-4 w-44',
              'right-2 top-16 w-40',
              'left-16 bottom-8 w-48',
              'right-8 bottom-20 w-36',
            ]
            const isActive = index === active
            return (
              <Link
                key={product.id}
                href={`/catalogue/${product.id}`}
                className={`absolute overflow-hidden border border-white/15 bg-[#FAF7F2]/95 shadow-[0_18px_50px_rgba(0,0,0,0.28)] transition-all duration-700 ease-out motion-reduce:transition-none ${
                  positions[index % positions.length]
                } ${isActive ? 'z-10 scale-105 opacity-100' : 'z-0 scale-100 opacity-80'}`}
                style={{
                  animation: `giffter-float ${10 + index * 2}s ease-in-out infinite`,
                  animationDelay: `${index * 0.4}s`,
                }}
              >
                <div className="aspect-square overflow-hidden">
                  <ProductImage
                    src={product.image_url}
                    alt={product.name}
                    size="md"
                    fit="cover"
                    className="h-full min-h-0 w-full"
                    imgClassName="catalogue-fill-zoom"
                  />
                </div>
                <div className="border-t border-[#E5DFD5]/70 px-3 py-2.5 text-[#1C1917]">
                  <p className="truncate text-[10px] uppercase tracking-[0.16em] text-[#3F3A34]">
                    {product.category_name}
                  </p>
                  <p className="mt-0.5 truncate font-serif text-sm">{product.name}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
