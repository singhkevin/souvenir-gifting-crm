import Link from 'next/link'

const SHOP_BY_PRICE = [
  { href: '/catalogue?budget=0-500', label: 'Below ₹500' },
  { href: '/catalogue?budget=500-1000', label: '₹501 to ₹1,000' },
  { href: '/catalogue?budget=1000-2000', label: '₹1,001 to ₹2,000' },
  { href: '/catalogue?budget=2000+', label: '₹2,000 & above' },
]

export function SiteFooter({
  workspaceHref,
  workspaceLabel,
}: {
  workspaceHref?: string | null
  workspaceLabel?: string | null
}) {
  return (
    <footer className="mt-0 border-t border-[#E8E4DE] bg-[#F6F4F1] text-[#1B2430]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <p className="font-serif text-3xl tracking-[0.06em]">GIFFTER</p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#5C6570]">
            Your destination for curated corporate gifts — catalogue, quotation and fulfilment in one place.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1A3022]">Shop</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-[#5C6570]">
            <Link href="/catalogue" className="hover:text-[#1B2430]">
              Catalogue
            </Link>
            <Link href="/collections" className="hover:text-[#1B2430]">
              Collections
            </Link>
            <Link href="/categories" className="hover:text-[#1B2430]">
              Categories
            </Link>
            <Link href="/collections#occasions" className="hover:text-[#1B2430]">
              Shop by occasion
            </Link>
            <Link href="/request-quote" className="hover:text-[#1B2430]">
              Request a Quote
            </Link>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1A3022]">About us</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-[#5C6570]">
            <Link href="/about" className="hover:text-[#1B2430]">
              About GIFFTER
            </Link>
            {workspaceHref && workspaceLabel ? (
              <Link href={workspaceHref} className="hover:text-[#1B2430]">
                {workspaceLabel}
              </Link>
            ) : (
              <Link href="/login" className="hover:text-[#1B2430]">
                Team login
              </Link>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1A3022]">Shop by price</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-[#5C6570]">
            {SHOP_BY_PRICE.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[#1B2430]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#E8E4DE] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-[#5C6570] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} GIFFTER. All rights reserved.</p>
          <p>Corporate gifting for teams, clients and brands.</p>
        </div>
      </div>
    </footer>
  )
}
