import { headers } from 'next/headers'
import { getProfile } from '@/lib/auth'
import { isBusinessRole, isClientRole } from '@/lib/roles'
import { landingPathForRole } from '@/lib/safe-next'
import { resolveHost } from '@/lib/portal-host'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import { homeCategoryTiles } from '@/lib/catalogue/curate'
import { slugify } from '@/lib/utils'

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  const headerStore = await headers()
  const hostKind = resolveHost(headerStore.get('x-forwarded-host') || headerStore.get('host')).kind
  const isClient = isClientRole(profile?.role)
  const isBusiness = isBusinessRole(profile?.role)
  const workspaceHref = profile ? (isClient ? '/portal/catalogue' : landingPathForRole(profile.role)) : null
  const workspaceLabel = profile ? (isClient ? 'Client portal' : isBusiness ? 'Business portal' : 'Workspace') : null
  const [products, categories] = await Promise.all([getPublicCatalogueProducts(), getPublicCategories()])
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

  return (
    <div className="min-h-screen bg-white text-[#1B2430]">
      <SiteHeader
        workspaceHref={workspaceHref}
        workspaceLabel={workspaceLabel}
        suggestions={suggestions}
        categoryLinks={categoryLinks}
        businessHref={isBusiness ? '/business/dashboard' : '/business'}
        hideAudience={hostKind === 'tenant'}
      />
      <main>{children}</main>
      <SiteFooter workspaceHref={workspaceHref} workspaceLabel={workspaceLabel} />
    </div>
  )
}
