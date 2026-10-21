import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Search, Upload } from 'lucide-react'
import { requireStaff, canSeeCosts } from '@/lib/auth'
import { isUuid, formatCurrency, oneRelation } from '@/lib/utils'
import { sortProductCategories } from '@/lib/products/categories'
import { readProductCost } from '@/lib/pricing/product-costs'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'
import { ProductImage } from '@/components/ui/product-image'

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
  // Default to active so CRM matches the public frontend keep-set; use ?status=all for inactive rows.
  const statusFilter = params.status || 'active'
  const accessFilter = params.access ?? ''
  const categoryFilter = isUuid(params.category) ? params.category! : ''
  const currentPage = Math.max(1, Number.parseInt(params.page || '1', 10) || 1)
  const from = (currentPage - 1) * PAGE_SIZE

  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select('*, product_costs(supplier_cost, internal_margin, internal_notes), category:categories(id, name), brand:brands(id, name), company_product_access(count)', { count: 'exact' })
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
          <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
            Product Catalogue
          </h1>
          <p className="mt-1 text-xs text-[#4A4640]">
            Every product carries a unique SKU and its own client visibility. <span className="font-mono">{total}</span> in this view.
          </p>
        </div>
        {['admin', 'sales'].includes(profile.role) && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/crm/products/import"
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-none border border-[#1C1B1A] bg-transparent px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A] transition-colors hover:bg-[#F6F3EC]"
            >
              <Upload size={14} /> Import CSV
            </Link>
            <Link
              href="/crm/products/new"
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
            >
              <Plus size={14} /> Add Product
            </Link>
          </div>
        )}
      </div>

      {params.removed === 'deleted' && (
        <div className="rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] p-3 text-xs text-[#3A4537]">
          Product removed.
        </div>
      )}

      <div className="space-y-3 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3 sm:p-4">
        <form className="flex w-full gap-2">
          {accessFilter ? <input type="hidden" name="access" value={accessFilter} /> : null}
          {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
          {statusFilter !== 'active' ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7C766F]" />
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Search by name or SKU..."
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] py-2 pl-9 pr-3 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
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

      {/* Desktop Master Inventory Table */}
      <div className="hidden overflow-x-auto rounded-none border border-[#CCC5BD] bg-[#FCF9F2] md:block">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Thumbnail &amp; SKU</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Product</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Brand</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Category</th>
              <th className="px-3.5 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">MOQ</th>
              {showCost && (
                <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Cost (₹)</th>
              )}
              <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Price (₹)</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Visibility</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD] text-xs text-[#1C1B1A]">
            {products && products.length > 0 ? (
              products.map((p) => {
                const brand = oneRelation(p.brand)
                const category = oneRelation(p.category)
                const companyCount = p.company_product_access?.[0]?.count || 0
                const cost = readProductCost(p)

                return (
                  <tr key={p.id} className="transition-colors hover:bg-[#F6F3EC]">
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden border border-[#CCC5BD] bg-[#F6F3EC]">
                          <ProductImage src={p.image_url} alt={p.name} size="sm" fit="cover" className="h-full w-full rounded-none" />
                        </div>
                        <span className="font-mono text-xs font-medium text-[#1C1B1A]">{p.sku}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Link
                        href={`/crm/products/${p.id}`}
                        className="font-semibold text-[#1C1B1A] transition-colors hover:text-[#9E4300]"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3.5 py-2.5 text-[#4A4640]">{brand?.name || '—'}</td>
                    <td className="px-3.5 py-2.5 text-[#4A4640]">{category?.name || '—'}</td>
                    <td className="px-3.5 py-2.5 text-center font-mono text-[#1C1B1A]">
                      {p.moq ? `${p.moq} units` : "—"}
                    </td>
                    {showCost && (
                      <td className="px-3.5 py-2.5 text-right font-mono text-[#4A4640]">
                        {formatCurrency(cost.supplier_cost)}
                      </td>
                    )}
                    <td className="px-3.5 py-2.5 text-right font-mono font-medium text-[#1C1B1A]">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {p.catalogue_access === 'all' ? (
                        <span className="inline-flex items-center rounded-none border border-[#CCC5BD] px-2 py-0.5 text-[10px] uppercase text-[#4A4640]">
                          All Clients
                        </span>
                      ) : p.catalogue_access === 'selected' ? (
                        <span className="inline-flex items-center rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-2 py-0.5 text-[10px] uppercase text-[#9E4300]">
                          {companyCount} {companyCount === 1 ? 'Client' : 'Clients'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-none border border-[#CCC5BD] px-2 py-0.5 text-[10px] uppercase text-[#7C766F]">
                          Internal Only
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {p.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2 py-0.5 text-[11px] uppercase text-[#3A4537]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> active
                        </span>
                      ) : p.status === 'discontinued' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-none border border-[#BA1A1A]/40 bg-[#BA1A1A]/10 px-2 py-0.5 text-[11px] uppercase text-[#BA1A1A]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#BA1A1A]" /> discontinued
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] px-2 py-0.5 text-[11px] uppercase text-[#4A4640]">
                          {p.status}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={showCost ? 9 : 8} className="p-8 text-center text-xs text-[#7C766F]">
                  No products found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="space-y-3 md:hidden">
        {products && products.length > 0 ? (
          products.map((p) => {
            const brand = oneRelation(p.brand)
            const category = oneRelation(p.category)
            const companyCount = p.company_product_access?.[0]?.count || 0
            const cost = readProductCost(p)

            return (
              <article key={p.id} className="space-y-2.5 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden border border-[#CCC5BD] bg-[#F6F3EC]">
                    <ProductImage src={p.image_url} alt={p.name} size="sm" fit="cover" className="h-full w-full rounded-none" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/crm/products/${p.id}`}
                      className="line-clamp-2 text-sm font-semibold text-[#1C1B1A] hover:text-[#9E4300]"
                    >
                      {p.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] text-[#7C766F]">{p.sku}</p>
                  </div>
                  <div className="shrink-0">
                    {p.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2 py-0.5 text-[10px] uppercase text-[#3A4537]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] px-2 py-0.5 text-[10px] uppercase text-[#4A4640]">
                        {p.status}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-[#CCC5BD] pt-2 text-xs text-[#4A4640]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Category: </span>
                    {category?.name || '—'}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Brand: </span>
                    {brand?.name || '—'}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Price: </span>
                    <span className="font-mono font-semibold text-[#1C1B1A]">{formatCurrency(p.price)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">MOQ: </span>
                    <span className="font-mono text-[#1C1B1A]">{p.moq ? `${p.moq} units` : "—"}</span>
                  </div>
                  {showCost && (
                    <div className="col-span-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Cost: </span>
                      <span className="font-mono text-[#4A4640]">{formatCurrency(cost.supplier_cost)}</span>
                    </div>
                  )}
                  <div className="col-span-2 pt-1">
                    {p.catalogue_access === 'all' ? (
                      <span className="inline-flex items-center rounded-none border border-[#CCC5BD] px-2 py-0.5 text-[10px] uppercase text-[#4A4640]">
                        All Clients
                      </span>
                    ) : p.catalogue_access === 'selected' ? (
                      <span className="inline-flex items-center rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-2 py-0.5 text-[10px] uppercase text-[#9E4300]">
                        {companyCount} {companyCount === 1 ? 'Client' : 'Clients'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-none border border-[#CCC5BD] px-2 py-0.5 text-[10px] uppercase text-[#7C766F]">
                        Internal Only
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-[#CCC5BD] pt-2">
                  <Link
                    href={`/crm/products/${p.id}`}
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:text-[#9E4300]"
                  >
                    View / Edit →
                  </Link>
                </div>
              </article>
            )
          })
        ) : (
          <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-8 text-center text-xs text-[#7C766F]">
            No products found matching your filters.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#CCC5BD] pt-4">
          {currentPage > 1 ? (
            <Link
              href={buildHref({ page: String(currentPage - 1) })}
              className="text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A] transition-colors hover:text-[#9E4300]"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-[#7C766F]">
            Page <span className="font-mono">{currentPage}</span> of <span className="font-mono">{totalPages}</span> · <span className="font-mono">{total}</span> products
          </span>
          {currentPage < totalPages ? (
            <Link
              href={buildHref({ page: String(currentPage + 1) })}
              className="text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A] transition-colors hover:text-[#9E4300]"
            >
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
