'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { siteContent } from '@/config/siteContent'

export type RetailHeroProduct = {
  id: string
  name: string
  image_url: string | null
}

const SLIDE_MS = 5600

function HeroImage({ src, alt }: { src: string | null; alt: string }) {
  const [ready, setReady] = useState(false)
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#31312C] border border-[#7C766F]/40">
      {!ready ? <div className="absolute inset-0 animate-pulse bg-[#31312C]" aria-hidden="true" /> : null}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={`h-full w-full object-cover transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setReady(true)}
          onError={() => setReady(true)}
        />
      ) : null}
    </div>
  )
}

function HeroCell({ product }: { product: RetailHeroProduct | null }) {
  if (!product) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#1C1B1A] border border-[#7C766F]/60 p-2.5" aria-hidden="true">
        <div className="min-h-0 flex-1 animate-pulse bg-[#31312C]" />
        <div className="mt-2 h-4 w-3/4 animate-pulse bg-[#31312C]" />
        <div className="mt-1.5 mb-1 h-3 w-16 animate-pulse bg-[#31312C]" />
      </div>
    )
  }

  return (
    <Link
      href={`/catalogue/${product.id}`}
      className="group flex h-full min-h-0 flex-col overflow-hidden bg-[#1C1B1A] border border-[#7C766F]/70 p-2.5 text-[#FCF9F2] transition-colors hover:border-[#CCC5BD] focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
    >
      <HeroImage src={product.image_url} alt={product.name} />
      <span className="mt-2 line-clamp-1 px-1 font-serif text-[14px] sm:text-[15px] text-[#FCF9F2] leading-5">{product.name}</span>
      <span className="px-1 pb-0.5 sv2-mono-sm text-[10px] text-[#FFB690] uppercase tracking-wider">View gift</span>
    </Link>
  )
}

function HeroGrid({ products }: { products: RetailHeroProduct[] }) {
  const cells = [0, 1, 2, 3].map((index) => products[index] || null)
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-2.5 sm:gap-3">
      {cells.map((product, index) => (
        <HeroCell key={product?.id || `empty-${index}`} product={product} />
      ))}
    </div>
  )
}

export function RetailHeroSlider({ slides }: { slides: RetailHeroProduct[][] }) {
  const frames = slides.length ? slides : [[]]
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const startX = useRef<number | null>(null)
  const dragged = useRef(false)
  const safeIndex = frames.length ? index % frames.length : 0

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (paused || reduceMotion || frames.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % frames.length)
    }, SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [paused, reduceMotion, frames.length])

  const go = (next: number) => {
    if (frames.length < 2) return
    setIndex((next + frames.length) % frames.length)
  }

  return (
    <div
      className="relative border border-[#7C766F] bg-[#31312C] p-4 sm:p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        startX.current = e.touches[0]?.clientX ?? null
        dragged.current = false
      }}
      onTouchMove={() => {
        dragged.current = true
      }}
      onTouchEnd={(e) => {
        if (!dragged.current || startX.current === null) return
        const endX = e.changedTouches[0]?.clientX ?? startX.current
        const delta = endX - startX.current
        if (Math.abs(delta) > 40) {
          go(delta > 0 ? safeIndex - 1 : safeIndex + 1)
        }
        startX.current = null
        dragged.current = false
      }}
    >
      <div className="flex items-center justify-between border-b border-[#7C766F]/60 pb-3 mb-3">
        <span className="font-sans text-xs text-[#FF8843] flex items-center gap-1.5 uppercase tracking-wider font-semibold">
          <span className="sv2-pulse-dot" aria-hidden="true" />
          Featured Gifts
        </span>
        <span className="sv2-mono-sm text-[11px] text-[#CCC5BD]">
          Set {safeIndex + 1} of {Math.max(1, frames.length)}
        </span>
      </div>

      <div className="relative h-[22rem] sm:h-[25rem] lg:h-[26rem] w-full overflow-hidden">
        {frames.map((slide, slideIndex) => (
          <div
            key={slide.map((product) => product.id).join('-') || slideIndex}
            className={`absolute inset-0 transition-opacity duration-500 ${
              slideIndex === safeIndex ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
            }`}
            aria-hidden={slideIndex !== safeIndex}
          >
            <HeroGrid products={slide} />
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {frames.length > 1 ? `Gift set ${safeIndex + 1} of ${frames.length}` : 'Featured gifts'}
      </p>
      <div className="mt-4 flex h-8 items-center justify-between border-t border-[#7C766F]/60 pt-3">
        <div className="flex items-center gap-2" role="tablist" aria-label="Featured gift sets">
          {frames.length > 1
            ? frames.map((slide, slideIndex) => (
                <button
                  key={slide.map((product) => product.id).join('-') || slideIndex}
                  type="button"
                  role="tab"
                  aria-selected={slideIndex === safeIndex}
                  aria-label={`Show gift set ${slideIndex + 1}`}
                  onClick={() => go(slideIndex)}
                  className={`h-1.5 transition-[width,background-color] duration-300 ${
                    slideIndex === safeIndex ? 'w-6 bg-[#9E4300]' : 'w-2 bg-[#7C766F] hover:bg-[#CCC5BD]'
                  }`}
                />
              ))
            : null}
        </div>
        {frames.length > 1 ? (
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="Previous gifts"
              onClick={() => go(safeIndex - 1)}
              className="flex h-8 w-8 items-center justify-center border border-[#7C766F] text-[#FCF9F2] hover:bg-[#1C1B1A] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next gifts"
              onClick={() => go(safeIndex + 1)}
              className="flex h-8 w-8 items-center justify-center border border-[#7C766F] text-[#FCF9F2] hover:bg-[#1C1B1A] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function RetailHero({ slides }: { slides: RetailHeroProduct[][] }) {
  return (
    <section className="bg-[#1C1B1A] text-[#FCF9F2] border-b border-[#CCC5BD]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
          <div className="flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 border border-[#7C766F] px-3 py-1 font-sans text-xs uppercase tracking-wider text-[#FFB690] font-semibold mb-5">
                <span>The Souvenir Collection</span>
              </div>
              <h1 className="font-serif sv2-display text-4xl sm:text-5xl lg:text-[3.35rem] leading-[1.05] tracking-tight text-[#FCF9F2]">
                Thoughtful gifting, <span className="italic font-normal text-[#FFB690]">handcrafted</span> to be cherished.
              </h1>
              <p className="mt-4 max-w-xl sv2-body-lg text-[#CCC5BD]">
                Thoughtfully assembled keepsakes, brassware, and gift hampers for personal celebrations, weddings, anniversaries, and homes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3.5">
                <Link
                  href="/catalogue"
                  className="inline-flex items-center bg-[#9E4300] hover:bg-[#FF8843] px-7 py-3.5 sv2-label text-white tracking-wider transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
                >
                  Explore Catalogue
                </Link>
                <Link
                  href="/request-quote"
                  className="inline-flex items-center border border-[#FCF9F2] px-7 py-3.5 sv2-label text-[#FCF9F2] tracking-wider hover:bg-[#FCF9F2] hover:text-[#000000] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
                >
                  Request a Quote
                </Link>
              </div>
            </div>

            {/* 4-item stat strip with hairline dividers */}
            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 border-t border-[#7C766F] pt-4 gap-3 font-sans text-xs">
              <div>
                <span className="block text-[#FFB690] font-bold font-mono">{siteContent.stats.dispatch}</span>
                <span className="text-[#CCC5BD] text-[10px] font-mono">{siteContent.retail.dispatchCities}</span>
              </div>
              <div className="border-l border-[#7C766F] pl-3">
                <span className="block text-[#FFB690] font-bold">Signature Box</span>
                <span className="text-[#CCC5BD] text-[10px]">Personalised Note</span>
              </div>
              <div className="border-l border-[#7C766F] pl-3">
                <span className="block text-[#FFB690] font-bold">Secure Payment</span>
                <span className="text-[#CCC5BD] text-[10px]">UPI, Cards &amp; NetBanking</span>
              </div>
              <div className="border-l border-[#7C766F] pl-3">
                <span className="block text-[#FFB690] font-bold">Direct Gifting</span>
                <span className="text-[#CCC5BD] text-[10px]">Hidden Invoice Option</span>
              </div>
            </div>
          </div>

          <div>
            <RetailHeroSlider slides={slides} />
          </div>
        </div>
      </div>
    </section>
  )
}

export function RetailHomeSkeleton() {
  return (
    <div className="bg-[#1C1B1A] text-[#FCF9F2] border-b border-[#CCC5BD]" aria-hidden="true">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:px-8 lg:py-16">
        <div>
          <div className="h-4 w-40 animate-pulse bg-[#31312C]" />
          <div className="mt-4 h-16 w-full max-w-md animate-pulse bg-[#31312C]" />
          <div className="mt-4 h-12 w-72 animate-pulse bg-[#31312C]" />
        </div>
        <div>
          <div className="grid h-[22.5rem] grid-cols-2 grid-rows-2 gap-3 sm:h-[26rem] lg:h-[28rem] border border-[#7C766F] p-4 bg-[#31312C]">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="animate-pulse bg-[#1C1B1A] border border-[#7C766F]/40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
