import Link from 'next/link'

export function SiteFooter({
  workspaceHref,
  workspaceLabel,
}: {
  workspaceHref?: string | null
  workspaceLabel?: string | null
}) {
  return (
    <footer className="mt-0 bg-[#122018] text-[#E8E1D5]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-3">
        <div>
          <p className="font-serif text-2xl text-[#FAF7F2]">GIFFTER</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#C9C0B2]">
            Corporate gifting, from first enquiry through fulfilment.
          </p>
        </div>
        <div className="text-sm text-[#C9C0B2]">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#A39B90]">Explore</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/catalogue" className="hover:text-[#FAF7F2]">
              Catalogue
            </Link>
            <Link href="/collections" className="hover:text-[#FAF7F2]">
              Collections
            </Link>
            <Link href="/categories" className="hover:text-[#FAF7F2]">
              Categories
            </Link>
            <Link href="/request-quote" className="hover:text-[#FAF7F2]">
              Request a Quote
            </Link>
          </div>
        </div>
        <div className="text-sm text-[#C9C0B2]">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#A39B90]">GIFFTER</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link href="/about" className="hover:text-[#FAF7F2]">
              About
            </Link>
            {workspaceHref && workspaceLabel ? (
              <Link href={workspaceHref} className="hover:text-[#FAF7F2]">
                {workspaceLabel}
              </Link>
            ) : (
              <Link href="/login" className="hover:text-[#FAF7F2]">
                Team login
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-[#8F877A] sm:px-8">
          © GIFFTER. Corporate gifting, refined.
        </p>
      </div>
    </footer>
  )
}
