import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/brand/brand-logo'

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F4EFE6] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <BrandLogo className="mx-auto h-10 w-auto object-contain sm:h-12" />
        <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#7A7267] mt-1">
          Corporate Gifting CRM
        </p>
        <p className="text-xs text-[#7A7267] mt-3">
          Corporate gifting, from enquiry to payment.
        </p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 border border-[#E5DFD5] sm:px-10">
          <p className="text-sm text-[#5A5248] mb-6 text-center">{title}</p>
          {subtitle ? <p className="text-xs text-[#7A7267] -mt-4 mb-6 text-center">{subtitle}</p> : null}
          {children}
        </div>
      </div>
    </div>
  )
}
