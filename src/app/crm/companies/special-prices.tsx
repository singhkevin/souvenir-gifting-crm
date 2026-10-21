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
    <section className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden space-y-0">
      <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD] flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">Special prices</h2>
        <span className="font-mono text-xs text-[#7C766F]">[ {rows.length} ]</span>
      </div>

      <div className="p-6 space-y-5 text-xs">
        <p className="text-xs text-[#4A4640]">
          A special price replaces the catalog price and the base price for this company until the end date. Leave the end date blank to keep it.
        </p>

        {missingTable ? (
          <p className="rounded-none border border-[#9E4300]/30 bg-[#FFB690]/20 px-3 py-2 text-xs text-[#9E4300] font-medium">
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

        <ActionForm action={saveCompanySpecialPrice} className="grid gap-3 sm:grid-cols-4 items-end" successMessage="Special price saved">
          <input type="hidden" name="company_id" value={companyId} />
          <input type="hidden" name="product_id" value={productId} />
          <div className="sm:col-span-2">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Chosen Product</span>
            <p className="text-xs text-[#1C1B1A] font-semibold">
              {chosen ? `${chosen.name} · ${chosen.sku}` : 'No product chosen yet.'}
            </p>
          </div>
          <label className="block space-y-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Price</span>
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 font-mono text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">End date</span>
            <input
              name="valid_until"
              type="date"
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 font-mono"
            />
          </label>
          <SubmitButton pendingLabel="Saving…" className="min-h-10 rounded-none bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors px-4 text-xs font-bold uppercase tracking-[0.12em] sm:col-span-4 shadow-none">
            Save special price
          </SubmitButton>
        </ActionForm>

        <div className="overflow-x-auto border border-[#CCC5BD] rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Product</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Price</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Ends</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CCC5BD]">
              {rows.map((row) => (
                <tr key={row.productId} className="hover:bg-[#F6F3EC] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ProductImage src={row.imageUrl} alt={row.name} size="sm" className="shrink-0 rounded-none border border-[#CCC5BD]" />
                      <div>
                        <p className="font-semibold text-[#1C1B1A]">{row.name}</p>
                        <p className="font-mono text-[10px] text-[#7C766F]">{row.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-right text-[#1C1B1A]">{formatCurrency(row.price)}</td>
                  <td className="px-4 py-3 font-mono text-[#4A4640]">{row.validUntil || 'No end date'}</td>
                  <td className="px-4 py-3 text-right">
                    <ActionForm action={removeCompanySpecialPrice} successMessage="Special price removed">
                      <input type="hidden" name="company_id" value={companyId} />
                      <input type="hidden" name="product_id" value={row.productId} />
                      <SubmitButton pendingLabel="Removing…" className="text-xs font-bold uppercase tracking-[0.08em] text-[#BA1A1A] hover:underline">
                        Remove
                      </SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-[#7C766F]">No special prices yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
