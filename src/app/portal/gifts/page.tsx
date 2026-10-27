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
import { getCompanyMarginPercent, getPricingSettings, sellPricesForSurface } from '@/lib/pricing/server'
import { gstPriceNote } from '@/lib/pricing/engine'
import { listCompanyCatalogs } from '@/lib/catalogs/company-catalogs'
import { catalogStatusLabel } from '@/lib/catalogs/status'
import { sampleOnlyProductIds } from '@/lib/samples/public'

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
  const showCollections = tab === 'catalogs' || tab === 'collections'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-normal tracking-tight text-[#1C1B1A] sm:text-4xl">Gifts</h1>
        <p className="mt-1 text-sm text-[#4A4640]">
          {showCollections
            ? 'Catalogs prepared for your team. Open one to add gifts to a quote.'
            : 'All gifts available to you. Add the ones you want to your quote basket.'}
        </p>
      </div>
      <div className="inline-flex border border-[#CCC5BD] bg-[#EBE8E1] p-0.5 rounded-none">
        <Link
          href="/portal/gifts"
          className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all rounded-none ${
            !showCollections
              ? 'bg-[#1C1B1A] text-[#FCF9F2]'
              : 'text-[#4A4640] hover:text-[#1C1B1A]'
          }`}
          aria-current={!showCollections ? 'page' : undefined}
        >
          All gifts
        </Link>
        <Link
          href="/portal/gifts?tab=catalogs"
          className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-all rounded-none ${
            showCollections
              ? 'bg-[#1C1B1A] text-[#FCF9F2]'
              : 'text-[#4A4640] hover:text-[#1C1B1A]'
          }`}
          aria-current={showCollections ? 'page' : undefined}
        >
          Catalogs for you
        </Link>
      </div>
      {showCollections ? <Collections companyId={companyId} /> : (
        <AllGifts q={q} category={category} sort={sort} page={page} companyId={companyId} />
      )}
    </div>
  )
}

async function Collections({ companyId }: { companyId: string | null }) {
  const supabase = await createClient()
  const catalogs = await listCompanyCatalogs(supabase, companyId)

  if (catalogs.length === 0) {
    return <EmptyState title="No catalogs yet" body="Your account manager will share a catalog when it is ready." />
  }

  return (
    <div className="space-y-4">
      {catalogs.map((catalog) => {
        const isReady = catalog.status === 'published_to_client' || catalog.status === 'order_ready'
        const isClosed = catalog.status === 'closed'
        const statusChipClass = isReady
          ? 'border-[#3A4537]/30 bg-[#DAE6D3] text-[#3A4537]'
          : isClosed
          ? 'border-[#CCC5BD] bg-[#EBE8E1] text-[#7C766F]'
          : 'border-[#CCC5BD] bg-[#F1EEE7] text-[#1C1C18]'

        return (
          <div
            key={catalog.id}
            className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-5 sm:p-6 transition-colors hover:border-[#1C1B1A]"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-xl sm:text-2xl font-normal text-[#1C1B1A]">{catalog.name}</h3>
                <p className="mt-2 font-mono text-xs text-[#4A4640]">
                  {catalog.employee_quantity != null ? `${catalog.employee_quantity.toLocaleString('en-IN')} people · ` : ''}
                  {catalog.budget_per_employee != null ? `${formatCurrency(catalog.budget_per_employee)} per person · ` : ''}
                  {catalog.total_budget != null ? `${formatCurrency(catalog.total_budget)} total` : ''}
                </p>
                {catalog.required_delivery_date ? (
                  <p className="mt-1 text-xs text-[#7C766F]">
                    Delivery <span className="font-mono text-[#1C1B1A]">{formatDate(catalog.required_delivery_date)}</span>
                  </p>
                ) : null}
              </div>
              <div className="shrink-0">
                <span className={`inline-block border px-2.5 py-0.5 text-[11px] uppercase tracking-wider rounded-none ${statusChipClass}`}>
                  {catalogStatusLabel(catalog.status)}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[#CCC5BD]">
              <Link
                href={`/portal/gifts/collection/${catalog.id}`}
                className="inline-flex min-h-10 items-center justify-center rounded-none bg-[#1C1B1A] px-4 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#9E4300] transition-colors"
              >
                View catalog
              </Link>
            </div>
          </div>
        )
      })}
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

  const hiddenSamples = await sampleOnlyProductIds(supabase, (productRows || []).map((product) => product.id))
  let products = (productRows || []).filter((product) => !hiddenSamples.has(product.id))
  let gstNote = 'excl. GST'
  const tenant = readTenantFromHeaders(await headers())
  if (products.length) {
    const companyMargin = companyId ? await getCompanyMarginPercent(companyId) : null
    const surface = tenant ? 'microsite' : 'portal'
    const [listedPrices, settings] = await Promise.all([
      sellPricesForSurface(products.map((product) => product.id), surface, companyMargin, companyId),
      getPricingSettings(),
    ])
    gstNote = gstPriceNote(settings.portals.corporate.gstMode)
    if (listedPrices) {
      products = products.map((product) => ({
        ...product,
        price: listedPrices.has(product.id) ? listedPrices.get(product.id) : product.price,
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
      <div className="space-y-4 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4 sm:p-5">
        <form className="flex w-full flex-col sm:flex-row gap-2">
          {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
          {sort && sort !== 'name' ? <input type="hidden" name="sort" value={sort} /> : null}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7C766F]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search gifts by name, SKU or description..."
              className="min-h-10 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] py-2 pl-9 pr-3 text-sm text-[#1C1C18] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-none bg-[#1C1B1A] px-5 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#9E4300] transition-colors"
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
          <p className="text-xs uppercase tracking-wider text-[#7C766F]">
            Showing {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  className="flex flex-col justify-between overflow-hidden rounded-none border border-[#CCC5BD] bg-[#FCF9F2] hover:border-[#1C1B1A] transition-colors group"
                >
                  <div>
                    <Link href={`/portal/gifts/${product.id}`} className="block">
                      <div className="relative aspect-square overflow-hidden border-b border-[#CCC5BD] bg-[#F1EEE7]">
                        <ProductImage
                          src={product.image_url}
                          alt={product.name}
                          size="md"
                          className="h-full w-full object-cover rounded-none"
                        />
                        {product.moq ? (
                          <span className="absolute top-2.5 left-2.5 border border-[#9E4300]/40 bg-[#FFDBCB]/90 text-[#9E4300] text-[10px] uppercase px-2 py-0.5 tracking-wider rounded-none">
                            MOQ {product.moq}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                    <div className="p-4 space-y-2">
                      {product.category_name ? (
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300] truncate">
                          {product.category_name}
                        </p>
                      ) : null}
                      <Link href={`/portal/gifts/${product.id}`} className="block">
                        <h3 className="font-serif text-lg text-[#1C1B1A] group-hover:text-[#9E4300] transition-colors line-clamp-1">
                          {product.name}
                        </h3>
                      </Link>
                      <p className="text-xs text-[#4A4640] line-clamp-2 leading-relaxed">
                        {product.description || ''}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 pt-0 space-y-3">
                    <div className="border-t border-[#CCC5BD] pt-3 flex items-baseline justify-between gap-2">
                      <div>
                        <p className="font-mono text-base font-semibold text-[#1C1C18]">
                          {product.price == null ? 'Price on request' : formatCurrency(product.price)}
                          {product.price != null ? <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">{gstNote}</span> : null}
                        </p>
                        <p className="text-[10px] text-[#7C766F] uppercase">Per unit</p>
                      </div>
                      {product.moq ? (
                        <span className="border border-[#CCC5BD] bg-[#F1EEE7] px-2 py-0.5 text-[10px] text-[#4A4640] rounded-none uppercase">
                          MOQ {product.moq}
                        </span>
                      ) : null}
                    </div>
                    <CatalogueShortlistButton product={shortlistProduct} />
                  </div>
                </article>
              )
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#CCC5BD]">
              {currentPage > 1 ? (
                <Link
                  href={pageHref(currentPage - 1)}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-none border border-[#CCC5BD] bg-[#FCF9F2] px-4 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1C18] hover:bg-[#F6F3EC] sm:flex-none transition-colors"
                >
                  Previous
                </Link>
              ) : <span className="flex-1 sm:flex-none" />}
              <span className="text-xs text-[#7C766F] uppercase tracking-wider">Page {currentPage} of {totalPages}</span>
              {currentPage < totalPages ? (
                <Link
                  href={pageHref(currentPage + 1)}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-none bg-[#1C1B1A] px-4 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#9E4300] sm:flex-none transition-colors"
                >
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
    <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-12 text-center">
      <Package className="mx-auto mb-3 h-10 w-10 text-[#7C766F]" />
      <p className="font-serif text-lg text-[#1C1B1A]">{title}</p>
      <p className="mt-1 text-xs text-[#7C766F]">{body}</p>
    </div>
  )
}
