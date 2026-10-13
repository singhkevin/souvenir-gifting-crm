import { SiteShell } from '@/components/site/site-shell'
import { StoreCartPrefill } from '@/components/site/store-cart-prefill'
import { parseCartAddQuery, planStoreCartAdd } from '@/lib/catalogue/cart-add'
import { getPublicCatalogueProducts } from '@/lib/catalogue/products'

export const dynamic = 'force-dynamic'

export default async function CartAddPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string }>
}) {
  const { items: raw } = await searchParams
  const requests = parseCartAddQuery(raw)
  const products = await getPublicCatalogueProducts()
  const plan = planStoreCartAdd(requests, products)
  const byId = new Map(products.map((product) => [product.id, product]))
  const items = plan.added.flatMap((added) => {
    const product = byId.get(added.id)
    if (!product) return []
    return [{
      id: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: added.quantity,
      maxQuantity: product.purchase.maxBuyQty,
    }]
  })

  return (
    <SiteShell>
      <StoreCartPrefill items={items} skipped={plan.skipped} />
    </SiteShell>
  )
}
