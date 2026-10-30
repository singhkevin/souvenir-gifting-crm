import { headers } from 'next/headers'
import { getProfile } from '@/lib/auth'
import { sessionHintFromHeaders } from '@/lib/auth/session-cookie'
import { isBusinessRole, isClientRole, isGiftEmployeeRole } from '@/lib/roles'
import { landingPathForRole } from '@/lib/safe-next'
import { getPublicCategories } from '@/lib/catalogue/products'
import { STORE_NAV_CATEGORIES, businessNavCategoryHref } from '@/lib/catalogue/store-nav'
import { getPublicContactPhone } from '@/lib/contact/public-phone-server'
import { UtilityBar } from '@/components/sv2/utility-bar'
import { SV2Header } from '@/components/sv2/header'
import { SV2Footer } from '@/components/sv2/footer'
import { newsreader, plusJakarta, jetbrainsMono } from '@/lib/fonts'
import '@/app/sv2.css'

/** Public business chrome: same header as /business, including the quote basket. */
export async function BusinessPublicFrame({ children }: { children: React.ReactNode }) {
  const headerStore = await headers()
  const profile = sessionHintFromHeaders((name) => headerStore.get(name)) ? await getProfile() : null
  const portalAccount = profile && (isClientRole(profile.role) || isGiftEmployeeRole(profile.role))
  const accountHref = profile && !portalAccount ? landingPathForRole(profile.role) : null
  const accountLabel =
    profile && !portalAccount ? (isBusinessRole(profile.role) ? 'Business portal' : 'Workspace') : null
  const [categories, phone] = await Promise.all([
    getPublicCategories().catch(() => []),
    getPublicContactPhone(),
  ])
  const navCategories = STORE_NAV_CATEGORIES.map((item) => ({
    href: businessNavCategoryHref(categories, item.name),
    label: item.label,
    icon: item.icon,
  }))

  return (
    <div
      className={`sv2 ${newsreader.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} min-h-screen bg-[#FCF9F2] text-[#1C1C18]`}
    >
      <UtilityBar phone={phone} />
      <SV2Header categories={navCategories} accountHref={accountHref} accountLabel={accountLabel} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <SV2Footer phone={phone} />
    </div>
  )
}
