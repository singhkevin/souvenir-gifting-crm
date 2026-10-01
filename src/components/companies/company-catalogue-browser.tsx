'use client'

import { useDeferredValue, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { ProductImage } from '@/components/ui/product-image'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { formatCurrency } from '@/lib/utils'
import {
  grantCompanyProductAccess,
  hideCompanyProduct,
  revokeCompanyProductAccess,
  showCompanyProduct,
} from '@/app/crm/products/actions'

export type CatalogueBrowserProduct = {
  id: string
  name: string
  sku: string
  price: number | null
  moq: number | null
  image_url: string | null
  catalogue_access: string
}

export type CatalogueBrowserRow = CatalogueBrowserProduct & {
  granted: boolean
  excluded: boolean
  visible: boolean
  type: 'global' | 'personalized'
}

type VisibilityFilter = 'all' | 'visible' | 'hidden'
type TypeFilter = 'all' | 'global' | 'personalized'

function friendlyError(message?: string) {
  if (!message) return 'Something went wrong. Please try again.'
  if (/schema cache|could not find the table/i.test(message)) {
    return 'Catalogue exclusions are not available on this database yet. Apply migration 20261002_company_product_exclusions, then retry.'
  }
  return message
}

export function CompanyCatalogueBrowser({
  companyId,
  companyName,
  rows,
  assignableProducts,
  canManageVisibility,
}: {
  companyId: string
  companyName: string
  rows: CatalogueBrowserRow[]
  assignableProducts: CatalogueBrowserProduct[]
  canManageVisibility: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const visibleCount = rows.filter((r) => r.visible).length
  const hiddenCount = rows.filter((r) => !r.visible).length

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return rows.filter((row) => {
      if (visibilityFilter === 'visible' && !row.visible) return false
      if (visibilityFilter === 'hidden' && row.visible) return false
      if (typeFilter === 'global' && row.type !== 'global') return false
      if (typeFilter === 'personalized' && row.type !== 'personalized') return false
      if (!q) return true
      return row.name.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q)
    })
  }, [rows, deferredQuery, visibilityFilter, typeFilter])

  const run = (
    productId: string,
    fn: () => Promise<{ error?: string } | void>,
    successMessage: string
  ) => {
    setPendingId(productId)
    startTransition(async () => {
      const result = await fn()
      setPendingId(null)
      if (result && 'error' in result && result.error) {
        toast.error(friendlyError(result.error))
        return
      }
      toast.success(successMessage)
      router.refresh()
    })
  }

  const assignProduct = async (formData: FormData) => {
    const productId = String(formData.get('product_id') || '')
    if (!productId) return
    run(productId, () => grantCompanyProductAccess(productId, companyId), 'Product assigned')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-bold text-sm text-gray-900">Catalogue for {companyName}</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-xl">
              What portal users at this company can browse. Globals are included by default;
              hide any item for this company only, or assign personalized products.
            </p>
            <p className="text-[11px] text-gray-400 mt-2">
              <span className="font-semibold text-gray-600">{visibleCount}</span> visible
              <span className="mx-1.5 text-gray-300">·</span>
              <span className="font-semibold text-gray-600">{hiddenCount}</span> hidden
            </p>
          </div>

          {canManageVisibility && assignableProducts.length > 0 && (
            <form
              action={assignProduct}
              className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end"
            >
              <MobileSheetSelect
                name="product_id"
                label="Assign personalized product"
                required
                className="w-full sm:w-64"
                emptyLabel="Choose a product..."
                options={[
                  { value: '', label: 'Choose a product...' },
                  ...assignableProducts.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.sku})`,
                  })),
                ]}
              />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex w-full items-center justify-center px-3 py-2 text-xs font-semibold text-white bg-[#806A50] hover:bg-[#624b32] rounded-lg transition-colors whitespace-nowrap sm:w-auto disabled:opacity-60"
              >
                <Plus size={14} className="mr-1" /> Assign
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or SKU"
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#806A50]/30 focus:border-[#806A50]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'All'],
                ['visible', 'Visible'],
                ['hidden', 'Hidden'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setVisibilityFilter(value)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${
                  visibilityFilter === value
                    ? 'bg-[#806A50] text-white border-[#806A50]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="hidden sm:block w-px self-stretch bg-gray-200 mx-0.5" aria-hidden />
            {(
              [
                ['all', 'Any type'],
                ['global', 'Global'],
                ['personalized', 'Personalized'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTypeFilter(value)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors ${
                  typeFilter === value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_7rem_5.5rem_9rem] gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          <span>Product</span>
          <span>Price</span>
          <span>MOQ</span>
          <span className="text-right">In portal</span>
        </div>

        <ul className="divide-y divide-gray-100">
          {filtered.map((row) => {
            const busy = pending && pendingId === row.id
            return (
              <li
                key={row.id}
                className={`px-4 py-3 ${row.visible ? 'bg-white' : 'bg-gray-50/70'}`}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_7rem_5.5rem_9rem] md:items-center md:gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ProductImage
                      src={row.image_url}
                      alt={row.name}
                      size="xs"
                      className="w-10 h-10 rounded-lg border border-gray-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/crm/products/${row.id}`}
                        className="block font-semibold text-sm text-gray-900 hover:text-[#806A50] truncate"
                      >
                        {row.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-400">
                        <span className="font-mono">{row.sku}</span>
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded font-semibold ${
                            row.type === 'global'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {row.type === 'global' ? 'Global' : 'Personalized'}
                        </span>
                        {!row.visible && (
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            <EyeOff size={10} /> Hidden for this company
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:block pl-[3.25rem] md:pl-0">
                    <span className="md:hidden text-[10px] uppercase tracking-wide text-gray-400">Price</span>
                    <span className="text-xs font-semibold text-gray-900">{formatCurrency(row.price)}</span>
                  </div>

                  <div className="flex items-center justify-between md:block pl-[3.25rem] md:pl-0">
                    <span className="md:hidden text-[10px] uppercase tracking-wide text-gray-400">MOQ</span>
                    <span className="text-xs text-gray-600">{row.moq || 1}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pl-[3.25rem] md:pl-0">
                    {canManageVisibility ? (
                      <>
                        {row.type === 'personalized' && row.granted && row.visible && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                row.id,
                                () => revokeCompanyProductAccess(row.id, companyId),
                                'Personalized access removed'
                              )
                            }
                            className="text-[11px] font-medium text-gray-400 hover:text-red-600 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            row.visible
                              ? run(
                                  row.id,
                                  () => hideCompanyProduct(row.id, companyId),
                                  `Hidden from ${companyName}`
                                )
                              : run(
                                  row.id,
                                  () => showCompanyProduct(row.id, companyId),
                                  `Shown to ${companyName}`
                                )
                          }
                          className={`inline-flex items-center gap-1.5 min-w-[4.75rem] justify-center px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                            row.visible
                              ? 'border-gray-200 text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700'
                              : 'border-[#806A50]/35 text-[#806A50] hover:bg-[#806A50]/10'
                          }`}
                        >
                          {row.visible ? (
                            <>
                              <EyeOff size={12} /> Hide
                            </>
                          ) : (
                            <>
                              <Eye size={12} /> Show
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          row.visible ? 'text-green-700' : 'text-gray-500'
                        }`}
                      >
                        {row.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        {row.visible ? 'Visible' : 'Hidden'}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}

          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-gray-400">
              {rows.length === 0
                ? `No catalogue products for ${companyName} yet.`
                : 'No products match this filter.'}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
