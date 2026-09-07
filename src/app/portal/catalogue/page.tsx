import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { OfferingActions } from './OfferingActions'
import { formatCurrency, asRows, isUuid } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { Package, Search } from 'lucide-react'
import { sortProductCategories } from '@/lib/products/categories'

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
        .select('id, display_name, client_description, client_image_url, selling_price, moq, campaign_id, campaign:campaigns(id, name, company_id)')
        .eq('visibility', 'published')
        .eq('campaign_id', campaignFilter)
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
          <p className="text-sm text-gray-500 mt-1">
            Shortlist the gifts you like and we will build your quotation around them.
          </p>
        </div>

        {!offerings?.length ? (
          <EmptyState
            title="Nothing to review just yet"
            body="Your account manager will share gifting options for this campaign shortly."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {offerings.map((offering) => {
              const campaign = Array.isArray(offering.campaign) ? offering.campaign[0] : offering.campaign
              return (
                <div key={offering.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
                  <ProductImage src={offering.client_image_url} alt={offering.display_name || 'Gift'} size="md" />
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
                        {campaign?.name}
                      </p>
                      <Link href={`/portal/catalogue/${offering.id}`}>
                        <h3 className="text-sm font-semibold text-gray-900 hover:text-[var(--color-primary)] line-clamp-1 mt-1">
                          {offering.display_name}
                        </h3>
                      </Link>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{offering.client_description || ''}</p>
                    </div>
                    <div className="pt-3 border-t border-gray-100 space-y-3">
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

  const categoryHref = (nextCategory: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (nextCategory) params.set('category', nextCategory)
    if (sort && sort !== 'name') params.set('sort', sort)
    const qs = params.toString()
    return `/portal/catalogue${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Explore gifts</h1>
        <p className="text-sm text-gray-500 mt-1">Curated corporate gifting for your team, ready to personalise.</p>
      </div>

      <form className="flex flex-col gap-3 bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {categoryFilter ? <input type="hidden" name="category" value={categoryFilter} /> : null}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search gifts"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md"
            />
          </div>
          <select name="sort" defaultValue={sort} className="text-sm border border-gray-200 rounded-md px-3 py-2 bg-white">
            <option value="name">Sort: A–Z</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
          </select>
          <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-primary)] text-white hover:text-white hover:opacity-90">
            Apply
          </button>
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
            <span className="text-xs text-gray-400 font-medium">Category:</span>
            <Link
              href={categoryHref('')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                !categoryFilter ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Products
            </Link>
            {categories.map((item) => (
              <Link
                key={item.id}
                href={categoryHref(item.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === item.id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        )}
      </form>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/portal/catalogue/product/${product.id}`}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
              >
                <div className="aspect-square bg-[#FAF7F2] border-b border-gray-100">
                  <ProductImage src={product.image_url} alt={product.name} size="md" className="min-h-0 h-full" />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {product.category_name && (
                      <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
                        {product.category_name}
                      </p>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 mt-1">{product.name}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description || ''}</p>
                  </div>
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-base font-semibold text-gray-900">{formatCurrency(product.price)}</p>
                    <p className="text-[10px] text-gray-400">MOQ: {product.moq || 1} units</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className="text-sm text-[var(--color-primary)] hover:underline">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link href={pageHref(currentPage + 1)} className="text-sm text-[var(--color-primary)] hover:underline">
                  Next →
                </Link>
              ) : (
                <span />
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
    <div className="bg-white p-12 rounded-lg text-center border border-gray-200">
      <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{body}</p>
    </div>
  )
}
