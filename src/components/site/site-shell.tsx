import { getProfile } from '@/lib/auth'
import { landingPathForRole } from '@/lib/safe-next'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { getPublicCatalogueProducts } from '@/lib/catalogue/products'

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  const isClient = profile?.role === 'client_admin' || profile?.role === 'client_user'
  const workspaceHref = profile ? (isClient ? '/portal' : landingPathForRole(profile.role)) : null
  const workspaceLabel = profile ? (isClient ? 'Client portal' : 'Workspace') : null
  const products = await getPublicCatalogueProducts()
  const suggestions = products.slice(0, 40).map((product) => ({
    id: product.id,
    name: product.name,
    category_name: product.category_name,
    href: `/catalogue/${product.id}`,
  }))

  return (
    <div className="min-h-screen bg-[#F7F4EF] text-[#1C1917]">
      <SiteHeader
        workspaceHref={workspaceHref}
        workspaceLabel={workspaceLabel}
        suggestions={suggestions}
      />
      <main>{children}</main>
      <SiteFooter workspaceHref={workspaceHref} workspaceLabel={workspaceLabel} />
    </div>
  )
}
