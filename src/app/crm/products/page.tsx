import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, Upload } from 'lucide-react'
import { requireStaff, canSeeCosts } from '@/lib/auth'
import { isUuid } from '@/lib/utils'
import { sortProductCategories } from '@/lib/products/categories'
import { ProductsBrowser } from '@/components/products/products-browser'

const PAGE_SIZE = 50

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; access?: string; category?: string; page?: string; removed?: string }>
}) {
  const profile = await requireStaff(['admin', 'sales', 'management', 'operations'])
  const showCost = canSeeCosts(profile.role)
  const params = await searchParams
  const search = (params.q || '').replace(/[,()*]/g, ' ').trim()
  const statusFilter = params.status || 'all'
  const accessFilter = params.access ?? ''
  const categoryFilter = isUuid(params.category) ? params.category! : ''
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

  if (categoryFilter) {
    query = query.eq('category_id', categoryFilter)
  }

  const [{ data: products, count }, { data: categoryRows }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from('categories').select('id, name'),
  ])

  const categories = sortProductCategories(categoryRows || [])
  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const buildHref = (overrides: Record<string, string>) => {
    const next = new URLSearchParams()
    if (search) next.set('q', search)
    if (statusFilter !== 'all') next.set('status', statusFilter)
    if (accessFilter) next.set('access', accessFilter)
    if (categoryFilter) next.set('category', categoryFilter)
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

      {params.removed === 'deleted' && (
        <div className="p-3 bg-green-50 text-green-800 text-xs rounded-xl border border-green-200">
          Product removed.
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form className="flex-1 max-w-sm flex gap-2">
            {accessFilter ? <input type="hidden" name="access" value={accessFilter} /> : null}
            {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
            {statusFilter !== 'all' ? <input type="hidden" name="status" value={statusFilter} /> : null}
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

          <div className="flex items-center gap-2 flex-wrap">
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

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
          <span className="text-xs text-gray-400 font-medium">Category:</span>
          <Link
            href={buildHref({ category: '', page: '' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              !categoryFilter ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Products
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={buildHref({ category: category.id, page: '' })}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                categoryFilter === category.id
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </Link>
          ))}
        </div>
      </div>

      <ProductsBrowser products={products || []} showCost={showCost} />

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
