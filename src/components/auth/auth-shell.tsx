import type { ReactNode } from 'react'
import { BrandName } from '@/components/brand/brand-name'

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
        <BrandName as="h1" className="font-serif text-3xl tracking-tight text-[#1C1917] sm:text-4xl" />
        <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#7A7267] mt-1">
          Corporate Gifting CRM
        </p>
        <p className="text-xs text-[#7A7267] mt-3">
          Corporate gifting, from enquiry to payment.
        </p>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl border border-[#E5DFD5] sm:px-10">
          <p className="text-sm text-[#5A5248] mb-6 text-center">{title}</p>
          {subtitle ? <p className="text-xs text-[#7A7267] -mt-4 mb-6 text-center">{subtitle}</p> : null}
          {children}
        </div>
      </div>
    </div>
  )
}
