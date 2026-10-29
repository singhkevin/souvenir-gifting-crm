'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { siteContent } from '@/config/siteContent'
import { businessProductPath } from '@/lib/business/portal-paths'

export interface FeaturedKitItem {
  id: string
  name: string
  sku?: string | null
  badge?: string | null
  leadSla?: string | null
  description?: string | null
  price: number | null
  priceText?: string | null
  moq: number
  imageUrl: string
}

interface FeaturedKitSliderProps {
  items: FeaturedKitItem[]
}

export function FeaturedKitSlider({ items }: FeaturedKitSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!items || items.length === 0) return null

  const current = items[currentIndex] || items[0]
  const total = items.length
  const displayIndex = String(currentIndex + 1).padStart(2, '0')
  const totalDisplay = String(total).padStart(2, '0')
  const displayPrice = current.price != null && current.price > 0

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? total - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === total - 1 ? 0 : prev + 1))
  }

  return (
    <div className="flex flex-col justify-between border border-[#7C766F] bg-[#1C1B1A]/80 p-4 sm:p-6 h-full">
      {/* Header row */}
      <div>
        <div className="flex items-center justify-between border-b border-[#7C766F] pb-3 mb-4">
          <span className="sv2-label text-[#FF8843] flex items-center gap-1.5 font-bold">
            <svg
              className="w-4 h-4 text-[#FF8843]"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            FEATURED CORPORATE GIFT
          </span>
          {current.sku && (
            <span className="sv2-mono-sm text-[#7C766F]">
              SKU: {current.sku}
            </span>
          )}
        </div>

        {/* Product image preview */}
        <Link href={businessProductPath(current.id)} className="relative block w-full aspect-[4/3] bg-[#000000] mb-4 overflow-hidden border border-[#7C766F]">
          <Image
            src={current.imageUrl}
            alt={current.name}
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-cover sv2-img-zoom"
            priority
          />
          {current.badge && (
            <div className="absolute top-3 left-3 bg-[#000000]/90 text-[#FFB690] sv2-label px-2.5 py-1 border border-[#7C766F]">
              {current.badge}
            </div>
          )}
          {current.leadSla && (
            <div className="absolute bottom-3 right-3 bg-[#1C1B1A]/90 px-3 py-1 sv2-body-sm text-xs text-[#FCF9F2] border border-[#7C766F]">
              Lead time: {current.leadSla}
            </div>
          )}
        </Link>

        {/* Spec data rail */}
        <div className="mb-4">
          <div className="flex flex-wrap justify-between items-baseline mb-1 gap-2">
            <h3 className="sv2-headline-sm text-[#FCF9F2] font-normal">
              <Link href={businessProductPath(current.id)} className="hover:text-[#FFB690]">
                {current.name}
              </Link>
            </h3>
            <span className={current.priceText ? 'max-w-[14rem] text-right text-xs font-medium leading-snug text-[#FFB690]' : 'sv2-mono-lg text-[#FFB690] whitespace-nowrap'}>
              {current.priceText ? (
                current.priceText
              ) : displayPrice ? (
                <>
                  {formatCurrency(current.price)}{' '}
                  <span className="sv2-body-sm text-xs font-normal text-[#7C766F]">/ unit</span>
                </>
              ) : (
                'Price on quote'
              )}
            </span>
          </div>
          {current.description && (
            <p className="sv2-body-sm text-[#868382]">
              {current.description}
            </p>
          )}
        </div>
      </div>

      {/* Slider controls & MOQ */}
      <div className="pt-3 border-t border-[#7C766F] flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="sv2-mono-sm border border-[#9E4300] text-[#FFB690] px-2 py-0.5">
            MOQ: {current.moq} Kits
          </span>
          <span className="sv2-label text-[10px] text-[#7C766F] hidden sm:inline">
            {siteContent.utilityBar.gstNote}
          </span>
        </div>

        {/* Pagination controls */}
        {total > 1 ? (
          <div className="flex items-center gap-1.5 sv2-mono-sm text-[#FCF9F2]">
            <span className="text-[#FFB690] font-bold">{displayIndex}</span>
            <span className="text-[#7C766F]">/ {totalDisplay}</span>
            <div className="flex items-center ml-2 border border-[#7C766F]">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous featured kit"
                className="p-1 hover:bg-[#7C766F]/40 text-[#FCF9F2] border-r border-[#7C766F] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next featured kit"
                className="p-1 hover:bg-[#7C766F]/40 text-[#FCF9F2] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
