import Image from 'next/image'
import Link from 'next/link'
import { BUDGET_BANDS } from '@/lib/catalogue/collections'

export function SiteFooter({
  workspaceHref,
  workspaceLabel,
}: {
  workspaceHref?: string | null
  workspaceLabel?: string | null
}) {
  return (
    <footer className="mt-0 border-t border-[#E8E4DE] bg-[#F6F4F1] text-[#1B2430]">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:gap-10 sm:px-6 sm:py-14 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="md:col-span-2 lg:col-span-1">
          <Image src="/logo.png" alt="Souvenir Gifting Solutions" width={196} height={85} className="h-[100px] w-auto" />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#5C6570]">
            Your destination for curated corporate gifts — catalogue, quotation and fulfilment in one place.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#806A50]">Shop</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#5C6570]">
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
              Shop by Occasion
            </Link>
            <Link href="/request-quote" className="hover:text-[#1B2430]">
              Request a Quote
            </Link>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#806A50]">About us</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#5C6570]">
            <Link href="/about" className="hover:text-[#1B2430]">
              About
            </Link>
            {workspaceHref && workspaceLabel ? (
              <Link href={workspaceHref} className="hover:text-[#1B2430]">
                {workspaceLabel}
              </Link>
            ) : (
              <Link href="/login" className="hover:text-[#1B2430]">
                Team Login
              </Link>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#806A50]">Shop by price</p>
          <div className="mt-4 flex flex-col gap-2.5 text-sm text-[#5C6570]">
            {BUDGET_BANDS.map((band) => (
              <Link key={band.id} href={`/catalogue?budget=${encodeURIComponent(band.id)}`} className="hover:text-[#1B2430]">
                {band.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#E8E4DE] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-[#5C6570] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} All rights reserved.</p>
          <p>Corporate gifting for teams, clients and brands.</p>
        </div>
      </div>
    </footer>
  )
}
