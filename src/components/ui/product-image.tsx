'use client'

import React from 'react'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'hero'

const sizeWrap: Record<Size, string> = {
  xs: 'w-8 h-8',
  sm: 'w-14 h-14',
  md: 'aspect-square w-full h-auto min-h-48',
  lg: 'w-32 h-32',
  hero: 'w-full aspect-square min-h-64',
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
      className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#FAF7F2] text-[#1A3022]"
      role="img"
      aria-label={alt || 'Product'}
    >
      <span className={cn('font-serif tracking-tight', compact ? 'text-xs' : 'text-lg')}>G</span>
      {!compact && <Package className="h-5 w-5 text-[#C4B8A8]" aria-hidden="true" />}
    </div>
  )
}

/**
 * Safe product thumbnail. Broken, empty, null and failed URLs all resolve
 * to the same GIFFTER placeholder — never a browser broken-image icon.
 */
export function ProductImage({
  src,
  alt,
  size = 'md',
  className = '',
}: {
  src?: string | null
  alt: string
  size?: Size
  className?: string
}) {
  const resolved = usableSrc(src)
  const [failed, setFailed] = React.useState(false)
  const showImage = Boolean(resolved) && !failed
  const compact = size === 'xs' || size === 'sm'

  React.useEffect(() => {
    setFailed(false)
  }, [resolved])

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[#FAF7F2] flex items-center justify-center',
        sizeWrap[size],
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved as string}
          alt={alt || 'Product'}
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <Fallback alt={alt} compact={compact} />
      )}
    </div>
  )
}
