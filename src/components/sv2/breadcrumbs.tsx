import Link from 'next/link'

export type Crumb = {
  label: string
  href?: string
}

/**
 * SV2 Breadcrumbs — the single breadcrumb style. Sans 12px, hairline slash
 * separators, muted links, charcoal current page. The last crumb is never a link.
 */
export function Breadcrumbs({ items, className = '' }: { items: Crumb[]; className?: string }) {
  const trail = items.filter(Boolean)
  if (trail.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      {trail.map((crumb, index) => {
        const isLast = index === trail.length - 1
        return (
          <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden="true" className="text-[#CCC5BD]">
                /
              </span>
            ) : null}
            {crumb.href && !isLast ? (
              <Link href={crumb.href} className="text-[#7C766F] transition-colors hover:text-[#1C1C18]">
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={isLast ? 'max-w-xs truncate text-[#1C1C18]' : 'text-[#7C766F]'}
              >
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
