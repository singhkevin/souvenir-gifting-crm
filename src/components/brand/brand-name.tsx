import { cn } from '@/lib/utils'

/**
 * Brand wordmark. Inherits surrounding font, weight, and color so inline
 * body/footer copy doesn’t look thin or faded. Display spots pass font-serif.
 */
export function BrandName({
  className,
  as: Tag = 'span',
}: {
  className?: string
  as?: 'span' | 'h1' | 'p' | 'div'
}) {
  return <Tag className={cn('not-italic', className)}>Souvenir Gifting Solutions</Tag>
}
