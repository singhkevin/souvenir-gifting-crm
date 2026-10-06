import type { Metadata } from 'next'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { PACK_OPTION_LABELS } from '@/lib/catalogue/budget-packs'
import { loadSharedCatalog, sharePath, type SharedCatalogProduct } from '@/lib/catalogs/share'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { companyCanUseCatalog, resolveShareCampaignId } from '@/lib/catalogs/rfq'
import { CatalogRfqPanel } from '@/components/catalogs/CatalogRfqPanel'
import { CatalogBuyPanel } from '@/components/catalogs/CatalogBuyPanel'
import { purchaseOfferFromProduct } from '@/lib/catalogue/purchase-path'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ token: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const catalog = await loadSharedCatalog(token)
  return {
    title: catalog?.name || 'Catalog link',
    description: catalog?.occasion ? `${catalog.occasion} gift catalog` : 'Curated gift catalog',
    robots: { index: false, follow: false },
  }
}

function money(value: number | string | null | undefined) {
  if (value == null || value === '') return null
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) ? amount : null
}

export default async function SharedCatalogPage({ params }: PageProps) {
  const { token } = await params
  const catalog = await loadSharedCatalog(token)

  if (!catalog) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl bg-[#F4EFE6] px-4 py-16 text-[#1C1917]">
        <h1 className="font-serif text-3xl">This catalog link is unavailable</h1>
        <p className="mt-3 text-sm text-[#5A5248]">
          The link may have expired or been revoked. Ask your account manager for a new one.
        </p>
      </main>
    )
  }

  const products = catalog.products || []
  const linesByKit = new Map<string, SharedCatalogProduct[]>()
  for (const product of products) {
    if (!product.pack_kit_id) continue
    const list = linesByKit.get(product.pack_kit_id) || []
    list.push(product)
    linesByKit.set(product.pack_kit_id, list)
  }
  const primaries = products.filter((product) => product.pack_kit_role !== 'line')
  const budget = money(catalog.budget_per_employee)

  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1C1917]">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#806A50]">Shared catalog</p>
        <h1 className="mt-2 font-serif text-4xl">{catalog.name}</h1>
        <p className="mt-2 text-sm text-[#5A5248]">
          {catalog.occasion ? `${catalog.occasion} · ` : ''}
          Prices are client sell prices.
          {budget != null && budget > 0 ? ` Budget ${formatCurrency(budget)} per person.` : ''}
        </p>
        {catalog.expires_at && (
          <p className="mt-1 text-xs text-[#7A7267]">Link expires {formatDate(catalog.expires_at)}</p>
        )}

        {primaries.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-[#E5DFD5] bg-white p-8 text-sm text-[#5A5248]">
            Nothing has been published on this catalog yet.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {primaries.map((product) => {
              const kit = product.pack_kit_id ? linesByKit.get(product.pack_kit_id) || [product] : [product]
              const kitTotal = money(product.pack_kit_total) ?? money(product.selling_price)
              const packKey = product.pack_option === 'A' || product.pack_option === 'B' || product.pack_option === 'C'
                ? product.pack_option
                : null
              return (
                <article key={product.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#E5DFD5] bg-white">
                  <ProductImage src={product.client_image_url} alt={product.display_name || 'Gift'} size="md" />
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    {packKey && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#806A50]">
                        {PACK_OPTION_LABELS[packKey]}
                      </p>
                    )}
                    <h2 className="text-base font-semibold">{product.display_name}</h2>
                    {product.client_description && (
                      <p className="text-xs text-[#5A5248]">{product.client_description}</p>
                    )}
                    {kit.length > 1 && (
                      <ul className="space-y-1 rounded-lg bg-[#FAF7F2] p-2 text-[11px] text-[#5A5248]">
                        {kit.map((line) => (
                          <li key={line.id} className="flex justify-between gap-2">
                            <span className="line-clamp-1">{line.display_name}</span>
                            <span>{formatCurrency(money(line.selling_price))}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-auto text-lg font-semibold">{formatCurrency(kitTotal)}</p>
                    <p className="text-[10px] text-[#7A7267]">
                      {purchaseOfferFromProduct({
                        fulfillment_mode: product.fulfillment_mode,
                        stock_qty: product.stock_qty,
                        price: kitTotal,
                        catalogKit: Boolean(product.pack_kit_id),
                      }).buy
                        ? 'Buy below'
                        : 'Request quote below'}
                      {kit.length > 1 ? ' · combined kit' : ` · MOQ ${product.moq || 1}`}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="mt-10 space-y-6">
          <SharePurchase token={token} products={primaries} />
        </div>
      </div>
    </main>
  )
}

async function SharePurchase({
  token,
  products,
}: {
  token: string
  products: SharedCatalogProduct[]
}) {
  const profile = await getProfile()
  const isClient = profile?.role === 'client_admin' || profile?.role === 'client_user'
  let mode: 'guest' | 'client-share' | 'staff' | 'unassigned' = 'guest'
  if (profile && !isClient) {
    mode = 'staff'
  } else if (isClient) {
    const supabase = await createClient()
    const [{ data: companyId }, campaignId] = await Promise.all([
      supabase.rpc('client_company_id'),
      resolveShareCampaignId(token),
    ])
    const allowed = Boolean(companyId && campaignId && await companyCanUseCatalog(supabase, campaignId, companyId))
    mode = allowed ? 'client-share' : 'unassigned'
  }

  const rows = products.map((product) => {
    const price = money(product.pack_kit_total) ?? money(product.selling_price)
    const offer = purchaseOfferFromProduct({
      fulfillment_mode: product.fulfillment_mode,
      stock_qty: product.stock_qty,
      price,
      catalogKit: Boolean(product.pack_kit_id),
    })
    return { product, price, offer }
  })
  const loginHref = `/login?next=${encodeURIComponent(sharePath(token))}`

  return (
    <>
      <CatalogBuyPanel
        mode={mode}
        shareToken={token}
        loginHref={loginHref}
        offerings={rows.filter((row) => row.offer.buy && row.product.product_id).map((row) => ({
          productId: row.product.product_id as string,
          name: row.product.display_name || 'Gift',
          price: row.price,
          maxBuyQty: row.offer.maxBuyQty,
        }))}
      />
      <CatalogRfqPanel
        mode={mode}
        shareToken={token}
        loginHref={loginHref}
        offerings={rows.filter((row) => row.offer.rfq).map((row) => ({
          id: row.product.id,
          name: row.product.display_name || 'Gift',
          sku: row.product.sku || null,
          price: row.price,
          moq: row.product.moq && row.product.moq > 0 ? row.product.moq : 1,
        }))}
      />
    </>
  )
}
