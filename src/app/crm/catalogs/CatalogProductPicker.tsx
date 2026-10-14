'use client'

import { addCatalogProducts } from './actions'
import { ProductPickerDrawer, type PickerProduct } from '@/components/products/product-picker-drawer'
import { IDEMPOTENCY_FIELD, newIdempotencyKey } from '@/lib/use-action'

export function CatalogProductPicker({
  catalogId,
  products,
}: {
  catalogId: string
  products: PickerProduct[]
}) {
  return (
    <ProductPickerDrawer
      variant="panel"
      products={products}
      title="Add products"
      description="Card grid of active products. Search by name or SKU, filter by category and price, then select several with a quantity."
      submitLabel="Add as draft"
      onSubmit={async (rows) => {
        const formData = new FormData()
        formData.set('campaign_id', catalogId)
        formData.set('quantities_json', JSON.stringify(Object.fromEntries(rows.map((row) => [row.id, row.quantity]))))
        rows.forEach((row) => formData.append('product_id', row.id))
        formData.set(IDEMPOTENCY_FIELD, newIdempotencyKey())
        const result = await addCatalogProducts(formData)
        if (result && !result.error) {
          return {
            ...result,
            message: result.skipped
              ? `Added ${result.added}. Skipped ${result.skipped} already on the catalog or inactive.`
              : `Added ${result.added} product${result.added === 1 ? '' : 's'} as drafts.`,
          }
        }
        return result
      }}
    />
  )
}
