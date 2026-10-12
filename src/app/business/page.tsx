import { SiteShell } from '@/components/site/site-shell'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function BusinessLandingPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#806A50]">For business</p>
        <h1 className="mt-3 font-serif text-4xl text-[#1B2430]">Indicative prices, then a quote</h1>
        <p className="mt-4 text-sm leading-6 text-[#5C6570]">
          Register a business account to browse the public catalogue with indicative B2B prices, build a multi-item quote, and accept it when the team sends the final quotation. Buying happens on the store, at the quoted price, after your account is verified.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/business/register" className="bg-[#806A50] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
            Register
          </Link>
          <Link href="/login?next=/business/dashboard" className="border border-[#E5DFD5] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
            Sign in
          </Link>
        </div>
      </section>
    </SiteShell>
  )
}
