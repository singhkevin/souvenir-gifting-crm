'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List, Globe, Lock, EyeOff } from 'lucide-react'
import { formatCurrency, oneRelation } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'

const VIEW_KEY = 'giffter.products.view'

export type ProductListItem = {
  id: string
  name: string
  sku: string
  image_url: string | null
  price: number | null
  supplier_cost: number | null
  moq: number | null
  status: string
  catalogue_access: string | null
  company_product_access?: { count: number }[] | null
  brand?: { id: string; name: string } | { id: string; name: string }[] | null
  category?: { id: string; name: string } | { id: string; name: string }[] | null
}

function VisibilityBadge({ access, companyCount }: { access: string | null; companyCount: number }) {
  if (access === 'all') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
        <Globe size={11} /> All companies
      </span>
    )
  }
  if (access === 'selected') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-[#4A235A]">
        <Lock size={11} /> {companyCount} {companyCount === 1 ? 'company' : 'companies'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
      <EyeOff size={11} /> Internal Only
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
        status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  )
}

export function ProductsBrowser({
  products,
  showCost,
}: {
  products: ProductListItem[]
  showCost: boolean
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY)
      if (saved === 'list' || saved === 'grid') setView(saved)
    } catch {
      // Preference is optional; grid remains the default.
    }
  }, [])

  const chooseView = (next: 'grid' | 'list') => {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Ignore storage failures; the choice still applies on this page.
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => chooseView('grid')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              view === 'grid' ? 'bg-[#4A235A] text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            aria-pressed={view === 'grid'}
          >
            <LayoutGrid size={13} /> Grid
          </button>
          <button
            type="button"
            onClick={() => chooseView('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              view === 'list' ? 'bg-[#4A235A] text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
            aria-pressed={view === 'list'}
          >
            <List size={13} /> List
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-xs text-gray-400">
            No products found matching your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {products.map((p) => {
              const category = oneRelation(p.category)
              const companyCount = p.company_product_access?.[0]?.count || 0
              return (
                <Link
                  key={p.id}
                  href={`/crm/products/${p.id}`}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:border-[#4A235A] hover:shadow-sm transition-all"
                >
                  <div className="aspect-square bg-[#FAF7F2] border-b border-gray-100">
                    <ProductImage src={p.image_url} alt={p.name} size="md" className="min-h-0 h-full" />
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col gap-2">
                    {category?.name && (
                      <p className="text-[10px] font-bold text-[#4A235A] uppercase tracking-wider">{category.name}</p>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{p.name}</h3>
                    <p className="font-mono text-[10px] text-gray-400">{p.sku}</p>
                    <div className="mt-auto pt-2 space-y-2 border-t border-gray-100">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(p.price)}</p>
                      {showCost && (
                        <p className="text-[11px] text-gray-500">Cost {formatCurrency(p.supplier_cost)}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={p.status} />
                        <VisibilityBadge access={p.catalogue_access} companyCount={companyCount} />
                      </div>
                      <span className="text-[11px] font-semibold text-[#4A235A]">View / Edit</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
          <table className="w-full text-xs min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase">Brand</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase">Category</th>
                {showCost && <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase">Cost</th>}
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase">Price</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase">MOQ</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase">Visibility</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => {
                const companyCount = p.company_product_access?.[0]?.count || 0
                const brand = oneRelation(p.brand)
                const category = oneRelation(p.category)
                return (
                  <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/crm/products/${p.id}`} className="flex items-center gap-3 group">
                        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-[#FAF7F2]">
                          <ProductImage src={p.image_url} alt={p.name} size="sm" className="rounded-xl border border-gray-200" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 group-hover:text-[#4A235A] transition-colors">{p.name}</p>
                          <p className="font-mono text-[10px] text-gray-400">{p.sku}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{brand?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 font-medium">{category?.name || '—'}</td>
                    {showCost && <td className="px-4 py-3 text-gray-700">{formatCurrency(p.supplier_cost)}</td>}
                    <td className="px-4 py-3 font-bold text-gray-900">{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3 text-gray-600">{p.moq || 1} units</td>
                    <td className="px-4 py-3">
                      <VisibilityBadge access={p.catalogue_access} companyCount={companyCount} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                )
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={showCost ? 8 : 7} className="p-8 text-center text-gray-400">
                    No products found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
