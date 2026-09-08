'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'
import type { PublicProduct } from '@/lib/catalogue/products'

const SLOT_COUNT = 4
const SLIDE_MS = 3000
const FADE_MS = 700

/** Bigger cards, tighter overlap — collage reads as one cluster. */
const SLOT_LAYOUT = [
  { className: 'left-0 top-0 w-[16.5rem]', z: 20 },
  { className: 'right-0 top-8 w-[15.5rem]', z: 30 },
  { className: 'left-8 bottom-0 w-[17.5rem]', z: 40 },
  { className: 'right-6 bottom-10 w-[15rem]', z: 10 },
] as const

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
  catalogueCount,
}: {
  products: PublicProduct[]
  catalogueCount: number
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
    // Start mid-catalogue so the first frame is a fresh set
    const start = pool.length > SLOT_COUNT ? Math.floor(pool.length / 3) : 0
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
          timers.push(
            window.setTimeout(() => {
              setPhase('idle')
            }, 40),
          )
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

  const contentClass =
    phase === 'out' || phase === 'in' ? 'opacity-0' : 'opacity-100'

  return (
    <section className="relative isolate min-h-[92vh] overflow-hidden bg-[#1A3022] text-[#FAF7F2]">
      <div className="absolute inset-0">
        <Image
          src="/site/hero-composition.webp"
          alt="Premium corporate gifts arranged for GIFFTER"
          fill
          priority
          sizes="100vw"
          className="object-cover scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102018]/95 via-[#1A3022]/88 to-[#1A3022]/78" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1A13]/75 via-transparent to-[#1A3022]/40" />
        <div className="absolute inset-0 bg-[#1A3022]/25" />
      </div>

      <div className="relative mx-auto grid min-h-[92vh] max-w-6xl items-end gap-8 px-5 pb-16 pt-28 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pb-24 lg:pt-32">
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
              className="border border-[#FAF7F2]/35 px-7 py-3 text-[11px] uppercase tracking-[0.18em] text-[#FAF7F2] transition-colors hover:bg-[#FAF7F2]/10"
            >
              Request a Quote
            </Link>
          </div>
          <p className="mt-8 text-xs tracking-wide text-[#FAF7F2]/90">
            {catalogueCount} gifts in the live catalogue
          </p>
        </div>

        <div className="relative mx-auto hidden h-[36rem] w-full max-w-[34rem] lg:block xl:h-[40rem]">
          {floats.map((product, index) => {
            const layout = SLOT_LAYOUT[index % SLOT_LAYOUT.length]
            return (
              <Link
                key={`slot-${index}`}
                href={`/catalogue/${product.id}`}
                className={`absolute overflow-hidden rounded-[1.35rem] catalogue-studio-field shadow-[0_14px_40px_rgba(0,0,0,0.18)] ${layout.className}`}
                style={{ zIndex: layout.z }}
              >
                <div
                  className={`transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${contentClass}`}
                >
                  <div className="aspect-square overflow-hidden catalogue-studio-field">
                    <ProductImage
                      src={product.image_url}
                      alt={product.name}
                      size="md"
                      fit="contain"
                      fadeEdges
                      className="h-full min-h-0 w-full bg-transparent"
                      imgClassName="catalogue-product-img scale-[1.05]"
                    />
                  </div>
                  <div className="border-t border-[#1A3022]/08 bg-[#E4D9C8] px-4 py-3 text-[#1C1917]">
                    <p className="truncate text-[10px] uppercase tracking-[0.16em] text-[#2A342C]/90">
                      {product.category_name}
                    </p>
                    <p className="mt-0.5 truncate font-serif text-[15px] leading-snug text-[#122018]">
                      {product.name}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
