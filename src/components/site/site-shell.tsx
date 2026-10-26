import { headers } from 'next/headers'
import { getProfile } from '@/lib/auth'
import { sessionHintFromHeaders } from '@/lib/auth/session-cookie'
import { isBusinessRole, isClientRole } from '@/lib/roles'
import { landingPathForRole } from '@/lib/safe-next'
import { resolveHost } from '@/lib/portal-host'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { CategoryNav } from '@/components/sv2/category-nav'
import { WhatsAppButton } from '@/components/site/whatsapp-button'
import { UtilityBar } from '@/components/sv2/utility-bar'
import { getPublicNavCategories, getPublicSearchSuggestions } from '@/lib/catalogue/products'
import { homeCategoryTiles } from '@/lib/catalogue/curate'
import { STORE_NAV_CATEGORIES, storeNavCategoryHref } from '@/lib/catalogue/store-nav'
import { slugify } from '@/lib/utils'
import { getPublicContactPhone } from '@/lib/contact/public-phone-server'
import { newsreader, plusJakarta, jetbrainsMono } from '@/lib/fonts'
import '@/app/sv2.css'

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const headerStore = await headers()
  const profile = sessionHintFromHeaders((name) => headerStore.get(name)) ? await getProfile() : null
  const hostKind = resolveHost(headerStore.get('x-forwarded-host') || headerStore.get('host')).kind
  const isClient = isClientRole(profile?.role)
  const isBusiness = isBusinessRole(profile?.role)
  const workspaceHref = profile ? (isClient ? '/portal/gifts' : landingPathForRole(profile.role)) : null
  const workspaceLabel = profile ? (isClient ? 'Client portal' : isBusiness ? 'Business portal' : 'Workspace') : null
  const [suggestions, categories, phone] = await Promise.all([
    getPublicSearchSuggestions(),
    getPublicNavCategories(),
    getPublicContactPhone(),
  ])
  const categoryLinks = homeCategoryTiles(categories, 6).map((category) => ({
    href: `/categories/${slugify(category.name)}`,
    label: category.name,
  }))

  const navCategories = STORE_NAV_CATEGORIES.map((item) => ({
    href: storeNavCategoryHref(categories, item.name),
    label: item.label,
    icon: item.icon,
  }))

  return (
    <div
      className={`sv2 ${newsreader.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} min-h-screen bg-[#FCF9F2] text-[#1C1C18]`}
    >
      <UtilityBar phone={phone} />
      <SiteHeader
        workspaceHref={workspaceHref}
        workspaceLabel={workspaceLabel}
        suggestions={suggestions}
        categoryLinks={categoryLinks}
        businessHref={isBusiness ? '/business/dashboard' : '/business'}
        hideAudience={hostKind === 'tenant'}
      >
        <CategoryNav items={navCategories} />
      </SiteHeader>
      <main>{children}</main>
      <SiteFooter workspaceHref={workspaceHref} workspaceLabel={workspaceLabel} phone={phone} />
      <WhatsAppButton phone={phone} />
    </div>
  )
}
