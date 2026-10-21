import Image from 'next/image'
import { appName } from '@/lib/brand'

/**
 * The real brand logo. Use this anywhere a logo is shown (headers, sidebars,
 * footers, auth screens) instead of typing the brand name as a wordmark.
 * `tone="light"` flattens the mark to cream for charcoal surfaces.
 */
export function BrandLogo({
  className = 'h-7 w-auto object-contain sm:h-8',
  tone = 'dark',
  priority = false,
}: {
  className?: string
  tone?: 'dark' | 'light'
  priority?: boolean
}) {
  return (
    <Image
      src="/logo.png"
      alt={appName()}
      width={140}
      height={44}
      priority={priority}
      className={`${tone === 'light' ? 'brightness-0 invert' : ''} ${className}`}
    />
  )
}
