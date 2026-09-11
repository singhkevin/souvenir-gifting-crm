import { cn } from '@/lib/utils'

/**
 * Brand wordmark. Inherits surrounding font, weight, and color so inline
 * body/footer copy doesn’t look thin or faded. Display spots pass font-serif.
 * Dash is a plain horizontal rule (Cormorant’s hyphen glyph leans).
 */
export function BrandName({
  className,
  as: Tag = 'span',
}: {
  className?: string
  as?: 'span' | 'h1' | 'p' | 'div'
}) {
  return (
    <Tag className={cn('not-italic', className)}>
      Souvenir
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '0.4em',
          height: '0.08em',
          marginLeft: '0.28em',
          marginRight: '0.28em',
          marginBottom: '0.18em',
          backgroundColor: 'currentColor',
          verticalAlign: 'middle',
          borderRadius: 1,
          flexShrink: 0,
        }}
      />
      Gifting Solutions
    </Tag>
  )
}
