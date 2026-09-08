import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, Upload } from 'lucide-react'
import { requireStaff, canSeeCosts } from '@/lib/auth'
import { isUuid } from '@/lib/utils'
import { sortProductCategories } from '@/lib/products/categories'
import { ProductsBrowser } from '@/components/products/products-browser'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

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
  // Default to active so CRM matches the public frontend keep-set; use ?status=all for archived rows.
  const statusFilter = params.status || 'active'
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
    if (statusFilter !== 'active') next.set('status', statusFilter)
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Catalogue</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Every product carries a unique SKU and its own client visibility. {total} in this view.
          </p>
        </div>
        {['admin', 'sales'].includes(profile.role) && (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/crm/products/import"
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 sm:flex-none"
          >
            <Upload size={14} /> Import CSV
          </Link>
          <Link
            href="/crm/products/new"
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#4A235A] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#3d1c4a] hover:text-white sm:flex-none"
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

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <form className="flex w-full gap-2">
          {accessFilter ? <input type="hidden" name="access" value={accessFilter} /> : null}
          {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
          {statusFilter !== 'active' ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Search by name or SKU..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#4A235A] sm:py-1.5 sm:text-xs"
            />
          </div>
          <button
            type="submit"
            className="min-h-10 shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200"
          >
            Search
          </button>
        </form>

        <MobileFilterBar
          pathname="/crm/products"
          preserveParams={{
            ...(search ? { q: search } : {}),
            ...(statusFilter !== 'active' ? { status: statusFilter } : {}),
            ...(accessFilter ? { access: accessFilter } : {}),
            ...(categoryFilter ? { category: categoryFilter } : {}),
          }}
          fields={[
            {
              key: 'status',
              label: 'Status',
              value: statusFilter === 'active' ? '' : statusFilter,
              emptyLabel: 'Active',
              options: [
                { value: '', label: 'Active' },
                { value: 'discontinued', label: 'Discontinued' },
                { value: 'all', label: 'All statuses' },
              ],
            },
            {
              key: 'access',
              label: 'Visibility',
              value: accessFilter,
              emptyLabel: 'Any',
              options: [
                { value: '', label: 'Any' },
                { value: 'all', label: 'All Clients' },
                { value: 'selected', label: 'Selected Clients' },
                { value: 'none', label: 'Internal Only' },
              ],
            },
            {
              key: 'category',
              label: 'Category',
              value: categoryFilter,
              emptyLabel: 'All products',
              options: [
                { value: '', label: 'All products' },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ],
            },
          ]}
        />
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
