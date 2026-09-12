'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'

const SLOT_COUNT = 4
const SLIDE_MS = 3500
const FADE_MS = 700

type TransitionPhase = 'idle' | 'out' | 'in'

function nextBatch(pool: PublicProduct[], start: number, count: number, avoid: string[] = []) {
  const ids: string[] = []
  let idx = start % pool.length
  let attempts = 0
  while (ids.length < count && attempts < pool.length * 2) {
    const candidate = pool[idx]
    if (!ids.includes(candidate.id) && (!avoid.includes(candidate.id) || pool.length <= count)) {
      ids.push(candidate.id)
    }
    idx = (idx + 1) % pool.length
    attempts++
  }
  while (ids.length < count && pool.length) {
    ids.push(pool[ids.length % pool.length].id)
  }
  return { ids, nextCursor: idx % pool.length }
}

export function HeroStage({
  products,
}: {
  products: PublicProduct[]
}) {
  const pool = useMemo(
    () => products.filter((product) => Boolean(product.image_url?.trim())),
    [products],
  )

  const [slotIds, setSlotIds] = useState<string[]>([])
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const cursorRef = useRef(0)
  const slotIdsRef = useRef<string[]>([])

  useEffect(() => {
    slotIdsRef.current = slotIds
  }, [slotIds])

  useEffect(() => {
    if (!pool.length) {
      setSlotIds([])
      return
    }
    const start = pool.length > SLOT_COUNT ? Math.floor(pool.length / 4) : 0
    const { ids, nextCursor } = nextBatch(pool, start, Math.min(SLOT_COUNT, pool.length))
    setSlotIds(ids)
    cursorRef.current = nextCursor
    setPhase('idle')
  }, [pool])

  useEffect(() => {
    if (pool.length < 2) return
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    const timers: number[] = []
    const timer = window.setInterval(() => {
      if (!slotIdsRef.current.length) return
      setPhase('out')
      timers.push(
        window.setTimeout(() => {
          const current = slotIdsRef.current
          const { ids, nextCursor } = nextBatch(pool, cursorRef.current, current.length, current)
          cursorRef.current = nextCursor
          setSlotIds(ids)
          setPhase('in')
          timers.push(window.setTimeout(() => setPhase('idle'), 40))
        }, FADE_MS),
      )
    }, SLIDE_MS)

    return () => {
      window.clearInterval(timer)
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [pool])

  const floats = slotIds
    .map((id) => pool.find((product) => product.id === id))
    .filter(Boolean) as PublicProduct[]

  const contentClass = phase === 'out' || phase === 'in' ? 'opacity-0' : 'opacity-100'
  const mobilePreview = floats.slice(0, 3)

  return (
    <section className="relative isolate overflow-hidden bg-[#1A3022] text-white">
      <div className="absolute inset-0">
        <Image
          src="/site/hero-composition.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0E1A13] via-[#1A3022]/92 to-[#1A3022]/75" />
      </div>

      <div className="relative mx-auto grid min-h-[auto] max-w-7xl items-center gap-8 px-4 py-12 sm:gap-10 sm:px-6 sm:py-16 lg:min-h-[78vh] lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
        <div>
          <h1 className="max-w-2xl font-serif leading-[1.2] tracking-tight">
            <span className="block text-[1.75rem] font-semibold italic text-[#F4EFE6] sm:text-[2.1rem] lg:text-[2.5rem] xl:text-[3.3rem]">
              Corporate gifting,
            </span>
            <span className="mt-1 block text-[1.75rem] font-semibold italic text-[#F4EFE6] sm:mt-2 sm:text-[2.1rem] lg:text-[2.5rem] xl:text-[3.3rem]">
              designed to be remembered.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/80 sm:mt-6 sm:text-base">
            Hand-picked gifts for teams, clients and brands — ready to quote and fulfil.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Link
              href="/catalogue"
              className="inline-flex items-center justify-center bg-white px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1A3022] sm:py-3"
            >
              Explore Catalogue
            </Link>
            <Link
              href="/request-quote"
              className="inline-flex items-center justify-center border border-white/40 px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-white/10 sm:py-3"
            >
              Request a Quote
            </Link>
          </div>
        </div>

        {/* Mobile product preview strip */}
        {mobilePreview.length > 0 ? (
          <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
            <div className={`flex w-max gap-3 transition-opacity duration-700 ${contentClass}`}>
              {mobilePreview.map((product) => (
                <Link
                  key={product.id}
                  href={`/catalogue/${product.id}`}
                  className="w-[42vw] max-w-[11.5rem] shrink-0 overflow-hidden rounded-md bg-white shadow-[0_10px_28px_rgba(0,0,0,0.22)]"
                >
                  <div className="aspect-square catalogue-studio-field">
                    <ProductImage
                      src={product.image_url}
                      alt={product.name}
                      size="sm"
                      fit="contain"
                      fadeEdges
                      className="h-full w-full bg-transparent"
                      imgClassName="catalogue-product-img"
                    />
                  </div>
                  <div className="border-t border-[#E8E4DE] px-2.5 py-2 text-[#1B2430]">
                    <p className="truncate text-center text-[11px] leading-snug">{product.name}</p>
                    <p className="mt-0.5 text-center text-[11px] font-semibold text-[#1A3022]">
                      {formatCurrency(product.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* Desktop collage */}
        <div className="mx-auto hidden w-full max-w-md grid-cols-2 gap-5 lg:grid">
          {floats.map((product, index) => (
            <Link
              key={`slot-${index}`}
              href={`/catalogue/${product.id}`}
              className="overflow-hidden rounded-md bg-white shadow-[0_16px_40px_rgba(0,0,0,0.28)]"
            >
              <div className={`transition-opacity duration-700 ease-in-out ${contentClass}`}>
                <div className="aspect-square catalogue-studio-field">
                  <ProductImage
                    src={product.image_url}
                    alt={product.name}
                    size="md"
                    fit="contain"
                    fadeEdges
                    className="h-full w-full bg-transparent"
                    imgClassName="catalogue-product-img scale-[1.04]"
                  />
                </div>
                <div className="border-t border-[#E8E4DE] bg-white px-3 py-2.5 text-[#1B2430]">
                  <p className="truncate text-center text-[12px] leading-snug">{product.name}</p>
                  <p className="mt-0.5 text-center text-[11px] font-semibold text-[#1A3022]">View gift</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
