import type { ReactNode } from 'react'
import { requireStaff } from '@/lib/auth'
import { SetupTabs } from './tabs'

export const dynamic = 'force-dynamic'

export default async function CatalogueSetupLayout({ children }: { children: ReactNode }) {
  await requireStaff(['admin'])
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 border-b border-gray-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#9E4300]">Catalogue setup</p>
        <h1 className="mt-1 font-serif text-2xl text-gray-900 sm:text-3xl">Retail store content</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          The retail homepage and the collections behind it. Business and corporate portals are not changed here.
        </p>
        <SetupTabs />
      </div>
      {children}
    </div>
  )
}
