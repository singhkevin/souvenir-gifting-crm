import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, oneRelation } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { Plus, Search, Globe, Lock, EyeOff, Upload } from 'lucide-react'
import { requireStaff, canSeeCosts } from '@/lib/auth'

const PAGE_SIZE = 50

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; access?: string; page?: string }> }) {
  const profile = await requireStaff(['admin', 'sales', 'management', 'operations'])
  const showCost = canSeeCosts(profile.role)
  const params = await searchParams
  const search = (params.q || '').replace(/[,()*]/g, ' ').trim()
  const statusFilter = params.status || 'all'
  // '' means "any visibility"; 'all' | 'selected' | 'none' filter on the real value.
  const accessFilter = params.access ?? ''
  const currentPage = Math.max(1, Number.parseInt(params.page || '1', 10) || 1)
  const from = (currentPage - 1) * PAGE_SIZE

  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('*, category:categories(id, name), brand:brands(id, name), company_product_access(count)', { count: 'exact' })
    .order('name')

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  if (accessFilter) {
    query = query.eq('catalogue_access', accessFilter)
  }

  const { data: products, count } = await query.range(from, from + PAGE_SIZE - 1)

  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const buildHref = (overrides: Record<string, string>) => {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    if (statusFilter !== 'all') next.set('status', statusFilter)
    if (accessFilter) next.set('access', accessFilter)
    Object.entries(overrides).forEach(([key, value]) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
    const qs = next.toString()
    return `/crm/products${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Catalogue</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Every product carries a unique SKU and its own client visibility. {total} in the catalogue.
          </p>
        </div>
        {['admin', 'sales'].includes(profile.role) && (
        <div className="flex items-center gap-2">
          <Link
            href="/crm/products/import"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-800 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <Upload size={14} /> Import CSV
          </Link>
          <Link
            href="/crm/products/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#4A235A] hover:bg-[#3d1c4a] hover:text-white shadow-sm transition-colors"
          >
            <Plus size={14} /> Add Product
          </Link>
        </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <form className="flex-1 max-w-sm flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Search by name or SKU..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4A235A]"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Filter
          </button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">Visibility:</span>
          {[
            { value: '', label: 'Any' },
            { value: 'all', label: 'All Clients' },
            { value: 'selected', label: 'Selected Clients' },
            { value: 'none', label: 'Internal Only' },
          ].map((option) => (
            <Link
              key={option.value || 'any'}
              href={buildHref({ access: option.value, page: '' })}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                accessFilter === option.value
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

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
            {products?.map((p) => {
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
                        <p className="font-bold text-gray-900 group-hover:text-[#4A235A] transition-colors">
                          {p.name}
                        </p>
                        <p className="font-mono text-[10px] text-gray-400">{p.sku}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium">
                    {brand?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium">
                    {category?.name || '—'}
                  </td>
                  {showCost && (
                    <td className="px-4 py-3 text-gray-700">
                      {formatCurrency(p.supplier_cost)}
                    </td>
                  )}
                  <td className="px-4 py-3 font-bold text-gray-900">
                    {formatCurrency(p.price)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.moq || 1} units
                  </td>
                  <td className="px-4 py-3">
                    {p.catalogue_access === 'all' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                        <Globe size={11} /> All companies
                      </span>
                    )}
                    {p.catalogue_access === 'selected' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-[#4A235A]">
                        <Lock size={11} /> {companyCount} {companyCount === 1 ? 'company' : 'companies'}
                      </span>
                    )}
                    {p.catalogue_access === 'none' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                        <EyeOff size={11} /> Internal Only
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                      p.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              )
            })}
            {(!products || products.length === 0) && (
              <tr>
                <td colSpan={showCost ? 8 : 7} className="p-8 text-center text-gray-400">
                  No products found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          {currentPage > 1 ? (
            <Link href={buildHref({ page: String(currentPage - 1) })} className="text-xs font-medium text-[var(--color-primary)] hover:underline">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-gray-500">
            Page {currentPage} of {totalPages} · {total} products
          </span>
          {currentPage < totalPages ? (
            <Link href={buildHref({ page: String(currentPage + 1) })} className="text-xs font-medium text-[var(--color-primary)] hover:underline">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  )
}
