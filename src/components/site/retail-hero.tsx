'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type RetailHeroProduct = {
  id: string
  name: string
  image_url: string | null
}

const SLIDE_MS = 5600

function HeroImage({ src, alt }: { src: string | null; alt: string }) {
  const [ready, setReady] = useState(false)
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-[#f6efe6]">
      {!ready ? <div className="absolute inset-0 animate-pulse bg-[#eadfd4]" aria-hidden="true" /> : null}
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
      <div className="flex h-full min-h-0 flex-col rounded-xl bg-white/90 p-2" aria-hidden="true">
        <div className="min-h-0 flex-1 animate-pulse rounded-lg bg-[#eadfd4]" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-[#eadfd4]" />
        <div className="mt-1.5 mb-1 h-3 w-16 animate-pulse rounded bg-[#eadfd4]" />
      </div>
    )
  }

  return (
    <Link
      href={`/catalogue/${product.id}`}
      className="group flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-white p-2 text-[#22180b] shadow-[0_12px_32px_rgba(20,14,8,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(20,14,8,0.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <HeroImage src={product.image_url} alt={product.name} />
      <span className="mt-1.5 line-clamp-1 px-1 text-[13px] font-semibold leading-5">{product.name}</span>
      <span className="px-1 pb-0.5 text-[11px] font-semibold tracking-[0.12em] text-[#735c00] uppercase">View gift</span>
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
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured gifts"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          go(safeIndex - 1)
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          go(safeIndex + 1)
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        startX.current = event.clientX
        dragged.current = false
      }}
      onPointerUp={(event) => {
        if (startX.current == null) return
        const delta = event.clientX - startX.current
        startX.current = null
        if (Math.abs(delta) < 48) return
        dragged.current = true
        go(delta > 0 ? safeIndex - 1 : safeIndex + 1)
      }}
      onClickCapture={(event) => {
        if (!dragged.current) return
        event.preventDefault()
        event.stopPropagation()
        dragged.current = false
      }}
    >
      <div className="relative h-[22.5rem] overflow-hidden sm:h-[26rem] lg:h-[28rem]">
        {frames.map((slide, slideIndex) => (
          <div
            key={slide.map((product) => product.id).join('-') || `slide-${slideIndex}`}
            className={`absolute inset-0 ${reduceMotion ? '' : 'transition-opacity duration-700 ease-out'} ${
              slideIndex === safeIndex ? 'opacity-100' : 'pointer-events-none opacity-0'
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
      <div className="mt-4 flex h-9 items-center justify-between">
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
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                    slideIndex === safeIndex ? 'w-6 bg-[#ffe088]' : 'w-1.5 bg-white/45 hover:bg-white/70'
                  }`}
                />
              ))
            : null}
        </div>
        {frames.length > 1 ? (
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous gifts"
              onClick={() => go(safeIndex - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/45 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next gifts"
              onClick={() => go(safeIndex + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/45 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function RetailHero({ slides }: { slides: RetailHeroProduct[][] }) {
  return (
    <section className="bg-[linear-gradient(115deg,#241c16_0%,#3a2e24_46%,#5a4636_100%)] text-[#fff8f4]">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-12 lg:px-8 lg:py-16">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#ffe088] uppercase">The Souvenir edit</p>
          <h1 className="mt-3 max-w-xl font-serif text-[2.45rem] leading-[1.05] tracking-tight text-[#fff8f4] sm:text-5xl lg:text-[3.35rem]">
            Corporate gifting, <span className="italic">designed to be remembered.</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-[#f6eadc]">
            Hand-picked gifts for teams, clients and brands — ready to quote and fulfil.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/catalogue"
              className="inline-flex items-center bg-white px-5 py-3 text-[11px] font-semibold tracking-[0.16em] text-[#22180b] uppercase hover:bg-[#fff1e5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Explore catalogue
            </Link>
            <Link
              href="/request-quote"
              className="inline-flex items-center border border-white/75 px-5 py-3 text-[11px] font-semibold tracking-[0.16em] text-white uppercase hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Request a quote
            </Link>
          </div>
        </div>
        <RetailHeroSlider slides={slides} />
      </div>
    </section>
  )
}

export function RetailHomeSkeleton() {
  return (
    <div className="bg-[#fff8f4]" aria-hidden="true">
      <div className="bg-[linear-gradient(115deg,#241c16_0%,#3a2e24_46%,#5a4636_100%)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:px-8 lg:py-16">
          <div>
            <div className="h-3 w-32 animate-pulse rounded bg-white/20" />
            <div className="mt-4 h-16 w-full max-w-md animate-pulse rounded bg-white/15" />
            <div className="mt-4 h-12 w-72 animate-pulse rounded bg-white/10" />
          </div>
          <div>
            <div className="grid h-[22.5rem] grid-cols-2 grid-rows-2 gap-3 sm:h-[26rem] lg:h-[28rem]">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="animate-pulse rounded-xl bg-white/85" />
              ))}
            </div>
            <div className="mt-4 h-9" />
          </div>
        </div>
      </div>
    </div>
  )
}
