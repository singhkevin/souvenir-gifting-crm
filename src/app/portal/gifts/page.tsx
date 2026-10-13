import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatCurrency, formatDate, isUuid } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { Package, Search } from 'lucide-react'
import { sortProductCategories } from '@/lib/products/categories'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'
import { CatalogueShortlistButton } from '@/components/portal/catalogue-shortlist-button'
import { headers } from 'next/headers'
import { readTenantFromHeaders } from '@/lib/portal-host'
import { getCompanyMarginPercent, sellPricesForSurface } from '@/lib/pricing/server'
import { listCompanyCatalogs } from '@/lib/catalogs/company-catalogs'
import { catalogStatusLabel } from '@/lib/catalogs/status'

const PAGE_SIZE = 24

function sanitiseSearch(value: string) {
  return value.replace(/[,()*]/g, ' ').trim().slice(0, 80)
}

export default async function GiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; catalog?: string; campaign?: string; q?: string; category?: string; sort?: string; page?: string }>
}) {
  const { tab = '', catalog, campaign, q = '', category = '', sort = 'name', page = '1' } = await searchParams
  const collectionId = catalog || campaign
  if (collectionId && isUuid(collectionId)) redirect(`/portal/gifts/collection/${collectionId}`)

  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')
  const showCollections = tab === 'collections'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gifts</h1>
        <p className="mt-1 text-sm text-gray-500">
          {showCollections
            ? 'Collections prepared for your team. Open one to add gifts to a quote.'
            : 'All gifts available to you. Add the ones you want to your quote basket.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/portal/gifts" className={tabClass(!showCollections)} aria-current={!showCollections ? 'page' : undefined}>
          All gifts
        </Link>
        <Link href="/portal/gifts?tab=collections" className={tabClass(showCollections)} aria-current={showCollections ? 'page' : undefined}>
          Collections for you
        </Link>
      </div>
      {showCollections ? <Collections companyId={companyId} /> : (
        <AllGifts q={q} category={category} sort={sort} page={page} companyId={companyId} />
      )}
    </div>
  )
}

function tabClass(active: boolean) {
  return `inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium ${
    active ? 'bg-primary/5 text-primary' : 'text-gray-600 hover:bg-gray-50'
  }`
}

async function Collections({ companyId }: { companyId: string | null }) {
  const supabase = await createClient()
  const catalogs = await listCompanyCatalogs(supabase, companyId)

  if (catalogs.length === 0) {
    return <EmptyState title="No collections yet" body="Your account manager will share a collection when it is ready." />
  }

  return (
    <div className="space-y-3">
      {catalogs.map((catalog) => (
        <div key={catalog.id} className="rounded-2xl border bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-serif text-lg">{catalog.name}</p>
            <span className="rounded-full bg-[#E1EFFE] px-2.5 py-0.5 text-[10px] font-semibold text-[#1E429F]">
              {catalogStatusLabel(catalog.status)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {catalog.employee_quantity?.toLocaleString('en-IN')} people · {formatCurrency(catalog.budget_per_employee)} per person · {formatCurrency(catalog.total_budget)} total
          </p>
          <p className="mt-1 text-xs">Delivery {formatDate(catalog.required_delivery_date)}</p>
          <Link
            href={`/portal/gifts/collection/${catalog.id}`}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#806A50] px-3 text-xs font-semibold text-white hover:bg-[#9C8567]"
          >
            View collection
          </Link>
        </div>
      ))}
    </div>
  )
}

async function AllGifts({
  q,
  category,
  sort,
  page,
  companyId,
}: {
  q: string
  category: string
  sort: string
  page: string
  companyId: string | null
}) {
  const supabase = await createClient()
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1)
  const from = (currentPage - 1) * PAGE_SIZE
  const search = sanitiseSearch(q)
  const categoryFilter = isUuid(category) ? category : ''

  let query = supabase.from('client_products').select('*', { count: 'exact' })
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`)
  if (categoryFilter) query = query.eq('category_id', categoryFilter)
  if (sort === 'price_low') query = query.order('price', { ascending: true })
  else if (sort === 'price_high') query = query.order('price', { ascending: false })
  else query = query.order('name', { ascending: true })

  const [{ data: productRows, count }, { data: categoryRows }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from('client_products').select('category_id, category_name').not('category_id', 'is', null),
  ])

  const categories = sortProductCategories(
    Array.from(
      new Map(
        (categoryRows || [])
          .filter((row) => row.category_id && row.category_name)
          .map((row) => [row.category_id as string, row.category_name as string]),
      ).entries(),
    ).map(([id, name]) => ({ id, name })),
  )

  let products = productRows || []
  const tenant = readTenantFromHeaders(await headers())
  if (tenant && products.length) {
    const companyMargin = companyId ? await getCompanyMarginPercent(companyId) : null
    const micrositePrices = await sellPricesForSurface(products.map((product) => product.id), 'microsite', companyMargin)
    if (micrositePrices) {
      products = products.map((product) => ({
        ...product,
        price: micrositePrices.has(product.id) ? micrositePrices.get(product.id) : product.price,
      }))
    }
  }

  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (categoryFilter) params.set('category', categoryFilter)
    if (sort && sort !== 'name') params.set('sort', sort)
    if (nextPage > 1) params.set('page', String(nextPage))
    const qs = params.toString()
    return `/portal/gifts${qs ? `?${qs}` : ''}`
  }

  return (
    <>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <form className="flex w-full gap-2">
          {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
          {sort && sort !== 'name' ? <input type="hidden" name="sort" value={sort} /> : null}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search gifts"
              className="min-h-10 w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#806A50]"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#806A50] px-3 text-xs font-semibold text-white hover:bg-[#9C8567]"
          >
            Search
          </button>
        </form>
        <MobileFilterBar
          pathname="/portal/gifts"
          preserveParams={q ? { q } : {}}
          fields={[
            {
              key: 'sort',
              label: 'Sort',
              value: sort === 'name' ? '' : sort,
              emptyLabel: 'A–Z',
              options: [
                { value: '', label: 'A–Z' },
                { value: 'price_low', label: 'Price: low to high' },
                { value: 'price_high', label: 'Price: high to low' },
              ],
            },
            {
              key: 'category',
              label: 'Category',
              value: categoryFilter,
              emptyLabel: 'All gifts',
              options: [
                { value: '', label: 'All gifts' },
                ...categories.map((item) => ({ value: item.id, label: item.name })),
              ],
            },
          ]}
        />
      </div>

      {!products.length ? (
        <EmptyState title="No gifts match your search" body="Try a different search term or clear the filters." />
      ) : (
        <>
          <p className="text-xs text-gray-500">
            Showing {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const shortlistProduct = {
                id: product.id,
                sku: product.sku,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
                category_name: product.category_name,
              }
              return (
                <article
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-[var(--color-primary)] hover:shadow-sm"
                >
                  <Link href={`/portal/gifts/${product.id}`} className="block">
                    <div className="aspect-square border-b border-gray-100 bg-[#FAF7F2]">
                      <ProductImage src={product.image_url} alt={product.name} size="md" className="h-full min-h-0" />
                    </div>
                  </Link>
                  <div className="flex flex-1 flex-col justify-between space-y-3 p-4 sm:p-5">
                    <div>
                      {product.category_name ? (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                          {product.category_name}
                        </p>
                      ) : null}
                      <Link href={`/portal/gifts/${product.id}`}>
                        <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900 hover:text-[#806A50]">{product.name}</h3>
                      </Link>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{product.description || ''}</p>
                    </div>
                    <div className="space-y-3 border-t border-gray-100 pt-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">
                          {product.price == null ? 'Price on request' : formatCurrency(product.price)}
                        </p>
                        <p className="text-[10px] text-gray-400">Per person · MOQ {product.moq || 1}</p>
                      </div>
                      <CatalogueShortlistButton product={shortlistProduct} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#806A50] hover:bg-[#FAF7F2] sm:flex-none">
                  Previous
                </Link>
              ) : <span className="flex-1 sm:flex-none" />}
              <span className="text-xs text-gray-500">Page {currentPage} of {totalPages}</span>
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[#806A50] px-3 text-xs font-semibold text-white hover:bg-[#9C8567] sm:flex-none">
                  Next
                </Link>
              ) : <span className="flex-1 sm:flex-none" />}
            </div>
          )}
        </>
      )}
    </>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
      <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{body}</p>
    </div>
  )
}
