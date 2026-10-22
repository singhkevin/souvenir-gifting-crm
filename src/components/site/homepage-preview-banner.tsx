import Link from 'next/link'

/** Shown only to admins previewing the draft homepage. */
export function HomepagePreviewBanner({ date, source }: { date: string; source: 'database' | 'built-in' }) {
  return (
    <div className="border-b border-[#9E4300] bg-[#FFDBCA] text-[#1C1C18]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <p className="font-sans text-xs font-semibold uppercase tracking-wider">
          Draft preview for <span className="font-mono">{date}</span> (India date)
          {source === 'built-in' ? ' · built-in content, homepage tables not set up yet' : ''}
        </p>
        <Link
          href="/crm/catalogue-setup/homepage"
          className="font-sans text-xs font-semibold uppercase tracking-wider text-[#9E4300] underline underline-offset-4 hover:text-[#1C1C18]"
        >
          Back to homepage setup
        </Link>
      </div>
    </div>
  )
}
