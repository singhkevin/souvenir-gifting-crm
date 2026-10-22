import Image from 'next/image'
import { BrandLogo } from '@/components/brand/brand-logo'
import { PortalFinderForm } from '@/components/site/portal-finder-form'
import { finderDestinations } from '@/lib/domain-routing'

const ENQUIRY_URL = 'https://www.souvenirgifting.com/business'

export function PortalFinder({ notice = '' }: { notice?: string }) {
  const links = finderDestinations()
  const storeHost = links.store.replace(/^https?:\/\//, '')
  const adminHost = links.adminLogin.replace(/^https?:\/\//, '').replace(/\/login$/, '')

  return (
    <div className="min-h-[100dvh] bg-[#F6F4F1] text-[#1B2430]">
      <div className="mx-auto grid min-h-[100dvh] max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-2 lg:px-8">
        <div className="relative hidden overflow-hidden lg:block">
          <Image
            src="/site/hero-composition.webp"
            alt="Corporate gifts arranged for a client programme"
            width={1200}
            height={1400}
            priority
            className="h-[36rem] w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-8 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Corporate gifting</p>
            <p className="mt-2 font-serif text-3xl">Gifts, catalogs, and one quote request.</p>
          </div>
        </div>
        <div>
          <BrandLogo className="h-12 w-auto object-contain" />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A7267]">
            Find your portal
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#5A5248]">
            Enter the company code from your portal address. We only open an exact match.
          </p>
          <div className="mt-6 overflow-hidden border border-[#E5DFD5] bg-white lg:hidden">
            <Image
              src="/site/hero-composition.webp"
              alt=""
              width={1200}
              height={700}
              priority
              className="h-44 w-full object-cover"
            />
          </div>
          <div className="mt-6 border border-[#E5DFD5] bg-white px-6 py-8 sm:px-8">
            {notice === 'login' ? (
              <p className="mb-6 border border-[#E5DFD5] bg-[#FAF7F2] px-3 py-3 text-xs leading-relaxed text-[#5A5248]">
                Staff sign in at{' '}
                <a href={links.adminLogin} className="font-semibold text-[#624B32] hover:underline">{adminHost}</a>
                . Shopping continues at{' '}
                <a href={links.store} className="font-semibold text-[#624B32] hover:underline">{storeHost}</a>.
              </p>
            ) : null}
            <PortalFinderForm />
          </div>
          <a
            href={ENQUIRY_URL}
            className="mt-4 inline-flex min-h-11 items-center justify-center bg-[#806A50] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-white"
          >
            Corporate gifting enquiry
          </a>
          <p className="mt-4 text-xs leading-relaxed text-[#7A7267]">
            Not a corporate client?{' '}
            <a href={links.store} className="font-semibold text-[#624B32] hover:underline">Shop at {storeHost}</a>
          </p>
        </div>
      </div>
    </div>
  )
}
