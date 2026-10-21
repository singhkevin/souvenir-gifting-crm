'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export type RetailHeroProduct = {
  id: string
  name: string
  image_url: string | null
  price: number | null
  sku?: string | null
}

const SLIDE_MS = 6000

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function RetailHeroSlider({ slides }: { slides: RetailHeroProduct[][] }) {
  const products = slides.flat().filter((product) => product?.id)
  const frames = products.length ? products : []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const startX = useRef<number | null>(null)
  const dragged = useRef(false)
  const safeIndex = frames.length ? index % frames.length : 0
  const product = frames[safeIndex]

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (paused || hidden || reduceMotion || frames.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % frames.length)
    }, SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [paused, hidden, reduceMotion, frames.length])

  const go = (next: number) => {
    if (frames.length < 2) return
    setIndex((next + frames.length) % frames.length)
  }

  return (
    <div
      className="relative rounded border border-charcoal-border bg-charcoal-surface p-4 shadow-lg sm:p-5"
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
      <div className="mb-4 flex items-center justify-between border-b border-charcoal-border pb-3">
        <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-saffron uppercase">Live showcase</p>
        {frames.length ? (
          <p className="font-mono text-xs text-charcoal-muted">
            {pad(safeIndex + 1)} / {pad(frames.length)}
          </p>
        ) : null}
      </div>

      <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-charcoal sm:aspect-[5/4] lg:aspect-[4/5] lg:max-h-[28rem]">
        {product?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className={`h-full w-full object-cover ${reduceMotion ? '' : 'transition-opacity duration-300'}`}
          />
        ) : (
          <div className="h-full w-full bg-charcoal-elevated" />
        )}
      </div>

      {product ? (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-serif text-[1.35rem] text-cream">{product.name}</p>
            {product.sku ? <p className="mt-1 font-mono text-xs tracking-[0.06em] text-charcoal-muted uppercase">{product.sku}</p> : null}
          </div>
          <div className="shrink-0 text-right">
            {product.price != null && product.price > 0 ? (
              <p className="font-mono text-xl font-semibold text-saffron">{formatCurrency(product.price)}</p>
            ) : null}
            <Link href={`/catalogue/${product.id}`} className="mt-1 inline-flex font-mono text-[11px] font-medium tracking-[0.08em] text-cream uppercase">
              View →
            </Link>
          </div>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {frames.length > 1 ? `Gift ${safeIndex + 1} of ${frames.length}` : 'Featured gifts'}
      </p>

      {frames.length > 1 ? (
        <div className="mt-4 flex items-center justify-between border-t border-charcoal-border pt-4">
          <div className="flex items-center gap-2" role="tablist" aria-label="Featured gift sets">
            {frames.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={slideIndex === safeIndex}
                aria-label={`Go to slide ${slideIndex + 1}`}
                onClick={() => go(slideIndex)}
                className={`h-1.5 rounded-full ${slideIndex === safeIndex ? 'w-6 bg-saffron' : 'w-1.5 bg-charcoal-muted'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous gifts"
              onClick={() => go(safeIndex - 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal-border text-cream hover:bg-charcoal-elevated"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next gifts"
              onClick={() => go(safeIndex + 1)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal-border text-cream hover:bg-charcoal-elevated"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function RetailHero({ slides }: { slides: RetailHeroProduct[][] }) {
  return (
    <section className="bg-charcoal text-cream">
      <div className="store-container grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 lg:py-28">
        <div>
          <p className="store-eyebrow text-saffron">The Souvenir edit</p>
          <h1 className="hero-title mt-4 max-w-xl text-cream">
            Corporate gifting,{' '}
            <span className="font-serif font-normal italic">designed to be remembered.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-charcoal-muted">
            Hand-picked gifts for teams, clients and brands — ready to quote and fulfil.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/catalogue"
              className="inline-flex h-12 items-center bg-saffron px-5 text-sm font-bold text-charcoal hover:bg-saffron-hover"
            >
              Explore catalogue
            </Link>
            <Link
              href="/collections"
              className="inline-flex h-12 items-center border border-cream/70 px-5 text-sm font-semibold text-cream hover:bg-charcoal-elevated"
            >
              View collections
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
    <div className="bg-cream" aria-hidden="true">
      <div className="bg-charcoal">
        <div className="store-container grid gap-8 py-16 lg:grid-cols-2 lg:py-28">
          <div>
            <div className="h-3 w-32 animate-pulse bg-charcoal-elevated" />
            <div className="mt-4 h-20 w-full max-w-md animate-pulse bg-charcoal-elevated" />
            <div className="mt-4 h-12 w-72 animate-pulse bg-charcoal-surface" />
          </div>
          <div className="aspect-[4/5] animate-pulse bg-charcoal-surface" />
        </div>
      </div>
    </div>
  )
}
