import { BrandName } from '@/components/brand/brand-name'
import { PortalFinderForm } from '@/components/site/portal-finder-form'
import { finderDestinations } from '@/lib/domain-routing'

export function PortalFinder({ notice = '' }: { notice?: string }) {
  const links = finderDestinations()
  const storeHost = links.store.replace(/^https?:\/\//, '')
  const adminHost = links.adminLogin.replace(/^https?:\/\//, '').replace(/\/login$/, '')

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-[#F4EFE6] px-4 py-12">
      <div className="mx-auto w-full max-w-lg text-center">
        <BrandName as="h1" className="font-serif text-3xl tracking-tight text-[#1C1917] sm:text-4xl" />
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7A7267]">
          Your company&apos;s gifting portal
        </p>
        <div className="mt-8 rounded-2xl border border-[#E5DFD5] bg-white px-6 py-8 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] sm:px-10">
          <p className="mb-6 text-center text-sm leading-relaxed text-[#5A5248]">
            Enter the company code from your portal address. We only open an exact match.
          </p>
          {notice === 'login' ? (
            <p className="mb-6 rounded-xl border border-[#E5DFD5] bg-[#FAF7F2] px-3 py-3 text-xs leading-relaxed text-[#5A5248]">
              Staff sign in at{' '}
              <a href={links.adminLogin} className="font-semibold text-[#624B32] hover:underline">
                {adminHost}
              </a>
              . Shopping continues at{' '}
              <a href={links.store} className="font-semibold text-[#624B32] hover:underline">
                {storeHost}
              </a>
              .
            </p>
          ) : null}
          <PortalFinderForm />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-[#7A7267]">
          Not a corporate client?{' '}
          <a href={links.store} className="font-semibold text-[#624B32] hover:underline">
            Shop at {storeHost}
          </a>
          {' · '}
          <a href={links.business} className="font-semibold text-[#624B32] hover:underline">
            Business enquiry
          </a>
        </p>
      </div>
    </div>
  )
}
