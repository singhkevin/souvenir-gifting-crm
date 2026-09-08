'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'
import type { PublicProduct } from '@/lib/catalogue/products'

const SLOT_COUNT = 4
const SLIDE_MS = 3500
const FADE_MS = 700

const SLOT_LAYOUT = [
  { className: 'left-2 top-2 w-[14.5rem]', z: 20 },
  { className: 'right-2 top-10 w-[13.5rem]', z: 30 },
  { className: 'left-10 bottom-2 w-[15rem]', z: 40 },
  { className: 'right-8 bottom-12 w-[13rem]', z: 10 },
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

      <div className="relative mx-auto grid min-h-[78vh] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
        <div>
          <p className="font-serif text-5xl tracking-[0.08em] text-white sm:text-6xl lg:text-7xl">GIFFTER</p>
          <h1 className="mt-5 max-w-xl font-serif text-3xl leading-tight tracking-tight text-white/95 sm:text-4xl lg:text-[2.75rem]">
            Corporate gifting, designed to be remembered.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/80">
            Hand-picked gifts for teams, clients and brands — ready to quote and fulfil.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/catalogue"
              className="bg-white px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1A3022]"
            >
              Explore Catalogue
            </Link>
            <Link
              href="/request-quote"
              className="border border-white/40 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-white/10"
            >
              Request a Quote
            </Link>
          </div>
          <p className="mt-6 text-xs tracking-wide text-white/70">{catalogueCount} gifts in the live catalogue</p>
        </div>

        <div className="relative mx-auto hidden h-[32rem] w-full max-w-[30rem] lg:block">
          {floats.map((product, index) => {
            const layout = SLOT_LAYOUT[index % SLOT_LAYOUT.length]
            return (
              <Link
                key={`slot-${index}`}
                href={`/catalogue/${product.id}`}
                className={`absolute overflow-hidden rounded-md bg-white shadow-[0_16px_40px_rgba(0,0,0,0.28)] ${layout.className}`}
                style={{ zIndex: layout.z }}
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
                    <p className="mt-0.5 text-center text-[11px] font-semibold text-[#1A3022]">
                      View gift
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
