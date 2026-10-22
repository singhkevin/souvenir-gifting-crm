import Link from 'next/link'

/**
 * Section header with large mono numeral, serif title, body subtitle,
 * and an optional right-aligned action link. Hairline rule below.
 *
 * Matches the design reference pattern:
 *   01  Shop by Occasion & Milestone
 *       Curated kits for every corporate occasion.
 *                                          View all occasions →
 *   ─────────────────────────────────────────────────────────────
 */
export function SectionHeader({
  numeral,
  title,
  subtitle,
  actionHref,
  actionLabel,
  dark = false,
}: {
  numeral: string
  title: React.ReactNode
  subtitle?: string
  actionHref?: string
  actionLabel?: string
  dark?: boolean
}) {
  return (
    <div
      className={`w-full max-w-full min-w-0 flex flex-col gap-4 border-b pb-4 mb-8 md:mb-12 md:flex-row md:items-baseline md:justify-between ${
        dark ? 'border-[#7C766F]' : 'border-[#CCC5BD]'
      }`}
    >
      <div className="flex items-baseline gap-3 md:gap-4 min-w-0">
        <span className="sv2-section-numeral shrink-0">{numeral}</span>
        <div className="min-w-0">
          <h2 className={`sv2-headline-lg ${dark ? 'text-[#FCF9F2]' : 'text-[#1C1C18]'}`}>
            {title}
          </h2>
          {subtitle && (
            <p className={`sv2-body-md mt-1 ${dark ? 'text-[#868382]' : 'text-[#4A4640]'}`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="sv2-label shrink-0 font-semibold text-[#9E4300] hover:underline underline-offset-4"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
