import { headers } from 'next/headers'
import { getProfile } from '@/lib/auth'
import { isBusinessRole, isClientRole } from '@/lib/roles'
import { landingPathForRole } from '@/lib/safe-next'
import { resolveHost } from '@/lib/portal-host'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { CategoryIconStrip } from '@/components/site/category-icon-strip'
import { WhatsAppButton } from '@/components/site/whatsapp-button'
import { getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import { homeCategoryTiles } from '@/lib/catalogue/curate'
import { STORE_NAV_CATEGORIES, storeNavCategoryHref } from '@/lib/catalogue/store-nav'
import { slugify } from '@/lib/utils'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePublicContactPhone } from '@/lib/contact/public-phone'

async function publicContactPhone() {
  const fromEnv = process.env.PUBLIC_CONTACT_PHONE
  const admin = createAdminClient()
  if (!admin) return resolvePublicContactPhone(fromEnv, null)
  const { data, error } = await admin.from('org_settings').select('public_contact_phone').limit(1).maybeSingle()
  if (error || !data) return resolvePublicContactPhone(fromEnv, null)
  return resolvePublicContactPhone(fromEnv, data.public_contact_phone as string | null)
}

export async function SiteShell({
  children,
  categoryVariant = 'cards',
}: {
  children: React.ReactNode
  categoryVariant?: 'cards' | 'compact'
}) {
  const profile = await getProfile()
  const headerStore = await headers()
  const hostKind = resolveHost(headerStore.get('x-forwarded-host') || headerStore.get('host')).kind
  const isClient = isClientRole(profile?.role)
  const isBusiness = isBusinessRole(profile?.role)
  const workspaceHref = profile ? (isClient ? '/portal/gifts' : landingPathForRole(profile.role)) : null
  const workspaceLabel = profile ? (isClient ? 'Client portal' : isBusiness ? 'Business portal' : 'Workspace') : null
  const [products, categories, phone] = await Promise.all([
    getPublicCatalogueProducts(),
    getPublicCategories(),
    publicContactPhone(),
  ])
  const suggestions = products.slice(0, 40).map((product) => ({
    id: product.id,
    name: product.name,
    category_name: product.category_name,
    href: `/catalogue/${product.id}`,
  }))
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
    <div className="storefront min-h-screen bg-cream text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:bg-cream-card focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <SiteHeader
        workspaceHref={workspaceHref}
        workspaceLabel={workspaceLabel}
        suggestions={suggestions}
        categoryLinks={categoryLinks}
        businessHref={isBusiness ? '/business/dashboard' : '/business'}
        hideAudience={hostKind === 'tenant'}
        phone={phone}
      >
        <CategoryIconStrip items={navCategories} variant={categoryVariant} />
      </SiteHeader>
      <main id="main">{children}</main>
      <SiteFooter workspaceHref={workspaceHref} workspaceLabel={workspaceLabel} phone={phone} />
      <WhatsAppButton phone={phone} />
    </div>
  )
}
