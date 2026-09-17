'use client'

import React from 'react'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'hero'
type Fit = 'contain' | 'cover'

/** Warm studio field — keep in sync with `.catalogue-studio-field` in globals.css */
export const STUDIO_FIELD = '#E4D9C8'

const sizeWrap: Record<Size, string> = {
  xs: 'w-8 h-8',
  sm: 'w-14 h-14',
  md: 'aspect-square w-full h-auto min-h-0',
  lg: 'w-32 h-32',
  hero: 'w-full aspect-square min-h-0',
}

function usableSrc(src?: string | null): string | null {
  if (!src) return null
  const trimmed = src.trim()
  if (!trimmed) return null
  if (trimmed === 'undefined' || trimmed === 'null') return null
  return trimmed
}

function Fallback({ alt, compact }: { alt: string; compact: boolean }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#806A50]"
      style={{ backgroundColor: STUDIO_FIELD }}
      role="img"
      aria-label={alt || 'Product'}
    >
      <span className={cn('font-serif tracking-tight', compact ? 'text-xs' : 'text-lg')}>S</span>
      {!compact && <Package className="h-5 w-5 text-[#C4B8A8]" aria-hidden="true" />}
    </div>
  )
}

/**
 * Safe product thumbnail. Broken, empty, null and failed URLs all resolve
 * to the same Souvenir - Gifting Solutions placeholder — never a browser broken-image icon.
 */
export function ProductImage({
  src,
  alt,
  size = 'md',
  fit = 'contain',
  className = '',
  imgClassName = '',
  fadeEdges = false,
}: {
  src?: string | null
  alt: string
  size?: Size
  fit?: Fit
  className?: string
  imgClassName?: string
  /** Feather photo edges into the studio field (public catalogue tiles). */
  fadeEdges?: boolean
}) {
  const resolved = usableSrc(src)
  const [failed, setFailed] = React.useState(false)
  const showImage = Boolean(resolved) && !failed
  const compact = size === 'xs' || size === 'sm'
  const fillParent =
    fit === 'cover' ||
    className.includes('h-full') ||
    className.includes('absolute') ||
    className.includes('inset-0')

  React.useEffect(() => {
    setFailed(false)
  }, [resolved])

  const wantsFade =
    fadeEdges ||
    imgClassName.includes('catalogue-product-img')

  return (
    <div
      className={cn(
        'relative overflow-hidden flex items-center justify-center catalogue-studio-field',
        fillParent ? 'h-full min-h-0 w-full' : sizeWrap[size],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved as string}
          alt={alt || 'Product'}
          loading="lazy"
          decoding="async"
          className={cn(
            'h-full w-full',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            fit === 'contain' && compact ? 'p-0.5' : fit === 'contain' ? 'p-0' : '',
            wantsFade && !imgClassName.includes('catalogue-product-img') ? 'catalogue-product-img' : '',
            imgClassName,
          )}
          onError={() => setFailed(true)}
        />
      ) : (
        <Fallback alt={alt} compact={compact} />
      )}
    </div>
  )
}
