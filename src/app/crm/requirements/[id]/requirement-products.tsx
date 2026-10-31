'use client'

import { ProductPickerDrawer, type PickerProduct } from '@/components/products/product-picker-drawer'
import { addProductsToRequirement } from '../actions'

export function RequirementProducts({
  requirementId,
  products,
  defaultQuantity,
}: {
  requirementId: string
  products: PickerProduct[]
  defaultQuantity: number
}) {
  return (
    <ProductPickerDrawer
      variant="panel"
      products={products}
      defaultQuantity={defaultQuantity}
      title="Add products"
      description="Search by name or SKU, filter by category, set a quantity, then add the selected products."
      submitLabel="Add selected"
      onSubmit={(rows) => addProductsToRequirement(
        requirementId,
        rows.map((row) => ({ productId: row.id, quantity: row.quantity })),
      )}
    />
  )
}
