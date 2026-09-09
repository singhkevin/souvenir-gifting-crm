import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { OfferingActions } from './OfferingActions'
import { formatCurrency, asRows, isUuid } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { Package, Search } from 'lucide-react'
import { sortProductCategories } from '@/lib/products/categories'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'
import { CatalogueShortlistButton } from '@/components/portal/catalogue-shortlist-button'

const PAGE_SIZE = 24

/** PostgREST `or=` filters are comma/parenthesis delimited, so strip those. */
function sanitiseSearch(value: string) {
  return value.replace(/[,()*]/g, ' ').trim().slice(0, 80)
}

export default async function PortalCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; q?: string; category?: string; sort?: string; page?: string }>
}) {
  const { campaign: campaignFilter, q = '', category = '', sort = 'name', page = '1' } = await searchParams
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')

  // Campaign mode keeps the existing curated-offering experience (with shortlisting),
  // which is scoped to a single campaign.
  if (campaignFilter) {
    const [{ data: offerings }, { data: selections }] = await Promise.all([
      supabase
        .from('campaign_products')
        .select('id, display_name, client_description, client_image_url, selling_price, moq, campaign_id, campaign:campaigns(id, name, company_id), product:products!inner(status)')
        .eq('visibility', 'published')
        .eq('campaign_id', campaignFilter)
        .eq('product.status', 'active')
        .order('display_order'),
      supabase.from('client_product_selections').select('campaign_product_id, kind').eq('company_id', companyId),
    ])

    const selectionByOffering = new Map(
      asRows<{ campaign_product_id: string; kind: string }>(selections).map((s: { campaign_product_id: string; kind: string }) => [s.campaign_product_id, s.kind])
    )

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your campaign selection</h1>
          <p className="mt-1 text-sm text-gray-500">
            Shortlist the gifts you like and we will build your quotation around them.
          </p>
        </div>

        {!offerings?.length ? (
          <EmptyState
            title="Nothing to review just yet"
            body="Your account manager will share gifting options for this campaign shortly."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {offerings.map((offering) => {
              const campaign = Array.isArray(offering.campaign) ? offering.campaign[0] : offering.campaign
              return (
                <div key={offering.id} className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <ProductImage src={offering.client_image_url} alt={offering.display_name || 'Gift'} size="md" />
                  <div className="flex flex-1 flex-col justify-between space-y-4 p-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                        {campaign?.name}
                      </p>
                      <Link href={`/portal/catalogue/${offering.id}`}>
                        <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900 hover:text-[var(--color-primary)]">
                          {offering.display_name}
                        </h3>
                      </Link>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{offering.client_description || ''}</p>
                    </div>
                    <div className="space-y-3 border-t border-gray-100 pt-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{formatCurrency(offering.selling_price)}</p>
                        <p className="text-[10px] text-gray-400">MOQ: {offering.moq || 1} units</p>
                      </div>
                      <OfferingActions
                        campaignId={offering.campaign_id}
                        campaignProductId={offering.id}
                        currentKind={selectionByOffering.get(offering.id) || null}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Default: the client's own gift catalogue.
  //
  // Everything is read through public.client_products, a definer view that resolves
  // the caller's company server-side and returns only the products that company may
  // see. Search, filtering, sorting, pagination and the total count all run inside
  // that boundary, so nothing outside the client's catalogue can leak through them.
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1)
  const from = (currentPage - 1) * PAGE_SIZE
  const search = sanitiseSearch(q)
  const categoryFilter = isUuid(category) ? category : ''

  let query = supabase.from('client_products').select('*', { count: 'exact' })

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`)
  }
  if (categoryFilter) {
    query = query.eq('category_id', categoryFilter)
  }

  if (sort === 'price_low') query = query.order('price', { ascending: true })
  else if (sort === 'price_high') query = query.order('price', { ascending: false })
  else query = query.order('name', { ascending: true })

  const [{ data: products, count }, { data: categoryRows }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.from('client_products').select('category_id, category_name').not('category_id', 'is', null),
  ])

  const categories = sortProductCategories(
    Array.from(
      new Map(
        (categoryRows || [])
          .filter((r) => r.category_id && r.category_name)
          .map((r) => [r.category_id as string, r.category_name as string])
      ).entries()
    ).map(([id, name]) => ({ id, name }))
  )

  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (categoryFilter) params.set('category', categoryFilter)
    if (sort && sort !== 'name') params.set('sort', sort)
    if (nextPage > 1) params.set('page', String(nextPage))
    const qs = params.toString()
    return `/portal/catalogue${qs ? `?${qs}` : ''}`
  }

  const preserveParams = {
    ...(q ? { q } : {}),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Explore gifts</h1>
        <p className="mt-1 text-sm text-gray-500">Curated corporate gifting for your team, ready to personalise.</p>
      </div>

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
              className="min-h-10 w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3022]"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433]"
          >
            Search
          </button>
        </form>

        <MobileFilterBar
          pathname="/portal/catalogue"
          preserveParams={preserveParams}
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
              emptyLabel: 'All products',
              options: [
                { value: '', label: 'All products' },
                ...categories.map((item) => ({ value: item.id, label: item.name })),
              ],
            },
          ]}
        />
      </div>

      {!products?.length ? (
        <EmptyState
          title="No gifts match your search"
          body="Try a different search term or clear the filters to see everything available to you."
        />
      ) : (
        <>
          <p className="text-xs text-gray-500">
            Showing {from + 1}–{Math.min(from + PAGE_SIZE, total)} of {total}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <article
                key={product.id}
                className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-[var(--color-primary)] hover:shadow-sm"
              >
                <Link href={`/portal/catalogue/product/${product.id}`} className="block">
                  <div className="aspect-square border-b border-gray-100 bg-[#FAF7F2]">
                    <ProductImage src={product.image_url} alt={product.name} size="md" className="h-full min-h-0" />
                  </div>
                </Link>
                <div className="flex flex-1 flex-col justify-between space-y-3 p-4 sm:p-5">
                  <div>
                    {product.category_name && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                        {product.category_name}
                      </p>
                    )}
                    <Link href={`/portal/catalogue/product/${product.id}`}>
                      <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-gray-900 hover:text-[#1A3022]">{product.name}</h3>
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{product.description || ''}</p>
                  </div>
                  <div className="space-y-3 border-t border-gray-100 pt-3">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{formatCurrency(product.price)}</p>
                      <p className="text-[10px] text-gray-400">MOQ: {product.moq || 1} units</p>
                    </div>
                    <CatalogueShortlistButton
                      product={{
                        id: product.id,
                        sku: product.sku,
                        name: product.name,
                        price: product.price,
                        image_url: product.image_url,
                        category_name: product.category_name,
                      }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              {currentPage > 1 ? (
                <Link
                  href={pageHref(currentPage - 1)}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#FAF7F2] sm:flex-none"
                >
                  Previous
                </Link>
              ) : (
                <span className="flex-1 sm:flex-none" />
              )}
              <span className="text-xs text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={pageHref(currentPage + 1)}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] sm:flex-none"
                >
                  Next
                </Link>
              ) : (
                <span className="flex-1 sm:flex-none" />
              )}
            </div>
          )}
        </>
      )}
    </div>
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
