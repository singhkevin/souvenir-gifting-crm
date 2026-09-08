'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'

export function HeroShowcase({ products }: { products: PublicProduct[] }) {
  const slides = products.slice(0, 5)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length)
    }, 4800)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (!slides.length) return null
  const active = slides[index]

  return (
    <div className="relative overflow-hidden bg-[#EFE8DC]">
      <div className="relative aspect-[4/5] sm:aspect-square lg:aspect-[5/6]">
        {slides.map((product, i) => (
          <Link
            key={product.id}
            href={`/catalogue/${product.id}`}
            className={`absolute inset-0 transition-opacity duration-1000 ease-out motion-reduce:transition-none ${
              i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
          >
            <ProductImage
              src={product.image_url}
              alt={product.name}
              size="hero"
              fit="cover"
              className="h-full min-h-0 w-full scale-[1.01] animate-[giffter-drift_18s_ease-in-out_infinite] motion-reduce:animate-none"
            />
          </Link>
        ))}
      </div>
      <div className="flex items-end justify-between gap-4 border-t border-[#C9C0B2]/70 px-1 pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#5A5348]">{active.category_name}</p>
          <p className="mt-1 font-serif text-xl text-[#1C1917]">{active.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-[#1A3022]">{formatCurrency(active.price)}</p>
          <div className="mt-3 flex justify-end gap-1.5">
            {slides.map((product, i) => (
              <button
                key={product.id}
                type="button"
                aria-label={`Show ${product.name}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === index ? 'bg-[#1A3022]' : 'bg-[#D6CEBE]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
