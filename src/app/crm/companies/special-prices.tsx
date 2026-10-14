'use client'

import { useState } from 'react'
import { ProductPickerDrawer, type PickerProduct } from '@/components/products/product-picker-drawer'
import { ProductImage } from '@/components/ui/product-image'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatCurrency } from '@/lib/utils'
import { removeCompanySpecialPrice, saveCompanySpecialPrice } from './special-price-actions'

export type SpecialPriceRow = {
  productId: string
  name: string
  sku: string
  imageUrl: string | null
  price: number
  validUntil: string | null
}

export function CompanySpecialPrices({
  companyId,
  products,
  rows,
  missingTable,
}: {
  companyId: string
  products: PickerProduct[]
  rows: SpecialPriceRow[]
  missingTable: boolean
}) {
  const [productId, setProductId] = useState('')
  const chosen = products.find((product) => product.id === productId)

  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">Special prices</h2>
        <p className="mt-1 text-xs text-gray-500">
          A special price replaces the catalog price and the base price for this company until the end date. Leave the end date blank to keep it.
        </p>
      </div>
      {missingTable ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Apply supabase/migrations/20261016_company_product_prices.sql before saving special prices.
        </p>
      ) : null}
      <ProductPickerDrawer
        products={products}
        title="Choose a product"
        description="Pick one product, then set its price and optional end date below."
        showQuantity={false}
        submitLabel="Use this product"
        onSubmit={async (selected) => {
          setProductId(selected[0]?.id || '')
          return { success: true }
        }}
      />
      <ActionForm action={saveCompanySpecialPrice} className="grid gap-3 sm:grid-cols-4" successMessage="Special price saved">
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="product_id" value={productId} />
        <p className="text-xs text-gray-700 sm:col-span-2">
          {chosen ? `${chosen.name} · ${chosen.sku}` : 'No product chosen yet.'}
        </p>
        <label className="text-xs">
          Price
          <input name="price" type="number" min="0" step="0.01" required className="mt-1 w-full rounded-lg border px-2 py-2" />
        </label>
        <label className="text-xs">
          End date
          <input name="valid_until" type="date" className="mt-1 w-full rounded-lg border px-2 py-2" />
        </label>
        <SubmitButton pendingLabel="Saving…" className="min-h-10 rounded-lg bg-[#806A50] px-3 text-xs font-semibold text-white sm:col-span-4">
          Save special price
        </SubmitButton>
      </ActionForm>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Price</th>
              <th className="p-3">Ends</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <ProductImage src={row.imageUrl} alt={row.name} size="sm" className="shrink-0 rounded" />
                    <div>
                      <p className="font-semibold">{row.name}</p>
                      <p className="font-mono text-[10px] text-gray-400">{row.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">{formatCurrency(row.price)}</td>
                <td className="p-3">{row.validUntil || 'No end date'}</td>
                <td className="p-3 text-right">
                  <ActionForm action={removeCompanySpecialPrice} successMessage="Special price removed">
                    <input type="hidden" name="company_id" value={companyId} />
                    <input type="hidden" name="product_id" value={row.productId} />
                    <SubmitButton pendingLabel="Removing…" className="text-xs font-semibold text-red-700 underline">Remove</SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-gray-400">No special prices yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
