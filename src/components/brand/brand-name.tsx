import { cn } from '@/lib/utils'

/**
 * Brand wordmark used everywhere.
 * Thin upright dash via inline styles so it never inherits Cormorant’s slanted/bold hyphen.
 */
export function BrandName({
  className,
  as: Tag = 'span',
}: {
  className?: string
  as?: 'span' | 'h1' | 'p' | 'div'
}) {
  return (
    <Tag
      className={cn('font-serif font-normal not-italic tracking-normal', className)}
      style={{ fontWeight: 400, fontStyle: 'normal' }}
    >
      Souvenir
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '0.42em',
          height: '0.06em',
          marginLeft: '0.28em',
          marginRight: '0.28em',
          marginBottom: '0.22em',
          backgroundColor: 'currentColor',
          opacity: 0.7,
          verticalAlign: 'middle',
          borderRadius: 1,
          flexShrink: 0,
        }}
      />
      Gifting Solutions
    </Tag>
  )
}
