import assert from 'node:assert/strict'
import test from 'node:test'
import { loadPublicRows, readNavCategories, readSearchSuggestions } from '../src/lib/catalogue/products'
import { hasAuthSessionCookie, publicReadSkipsSession } from '../src/lib/auth/session-cookie'
import { optimisedImageSrc } from '../src/components/ui/optimised-src'

type Call = {
  table: string
  select: string
  filters: [string, unknown][]
  limit?: number
  order?: string
}

function fakeClient(respond: (call: Call) => { data: unknown; error: { message: string } | null }) {
  const calls: Call[] = []
  return {
    calls,
    from(table: string) {
      const call: Call = { table, select: '', filters: [] }
      calls.push(call)
      const builder: Record<string, unknown> = {
        select(select: string) {
          call.select = select
          return builder
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value])
          return builder
        },
        order(column: string) {
          call.order = column
          return builder
        },
        limit(limit: number) {
          call.limit = limit
          return builder
        },
        maybeSingle() {
          return Promise.resolve(respond(call))
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(respond(call)).then(resolve, reject)
        },
      }
      return builder
    },
  }
}

const product = {
  id: 'p1',
  name: 'Bottle',
  sku: 'BTL',
  description: 'A long description that the header search does not need',
  image_url: 'https://example.supabase.co/storage/v1/object/public/product-images/bottle.webp',
  price: 100,
  moq: 25,
  category_id: 'c1',
  brand_id: 'b1',
  status: 'active',
  created_at: null,
  stock_qty: 3,
  fulfillment_mode: 'auto',
  sample_only: false,
  occasion_tags: ['welcome'],
  category: { id: 'c1', name: 'Drinkware' },
  brand: { id: 'b1', name: 'Souvenir', logo_url: '/logo.png' },
  product_costs: { supplier_cost: 40 },
}

test('priced catalogue is one query and includes tags, logo and cost', async () => {
  const client = fakeClient(() => ({ data: [product], error: null }))
  const rows = await loadPublicRows(client as never, 'store')
  assert.equal(client.calls.length, 1)
  assert.equal(client.calls[0].table, 'products')
  assert.equal(client.calls[0].limit, undefined)
  assert.match(client.calls[0].select, /occasion_tags/)
  assert.match(client.calls[0].select, /logo_url/)
  assert.match(client.calls[0].select, /product_costs/)
  assert.deepEqual(client.calls[0].filters, [
    ['status', 'active'],
    ['show_in_store', true],
  ])
  assert.equal(rows[0].occasion_tags && (rows[0].occasion_tags as string[])[0], 'welcome')
  assert.equal(rows[0].supplier_cost, 40)
})

test('missing channel column falls back once, without a limit-1 probe', async () => {
  const client = fakeClient((call) => {
    const channel = call.filters.find(([column]) => column === 'show_in_store' || column === 'catalogue_access')
    if (channel?.[0] === 'show_in_store') return { data: null, error: { message: 'column products.show_in_store does not exist' } }
    return { data: [], error: null }
  })
  const rows = await loadPublicRows(client as never, 'store')
  assert.equal(rows.length, 0)
  assert.equal(client.calls.length, 2)
  assert.equal(client.calls.every((call) => call.limit == null), true)
  assert.deepEqual(client.calls[1].filters, [
    ['status', 'active'],
    ['catalogue_access', 'all'],
  ])
})

test('header suggestions are 40 name-sorted rows and skip the priced catalogue', async () => {
  const client = fakeClient(() => ({ data: [product], error: null }))
  const suggestions = await readSearchSuggestions(client as never)
  assert.equal(client.calls.length, 1)
  assert.equal(client.calls[0].limit, 40)
  assert.equal(client.calls[0].order, 'name')
  assert.equal(client.calls[0].select.includes('description'), false)
  assert.equal(client.calls[0].select.includes('price'), false)
  assert.equal(client.calls[0].select.includes('moq'), false)
  assert.equal(client.calls[0].select.includes('product_costs'), false)
  assert.equal(client.calls[0].select.includes('occasion_tags'), false)
  assert.deepEqual(suggestions, [{
    id: 'p1',
    name: 'Bottle',
    category_name: 'Drinkware',
    image_url: product.image_url,
    href: '/catalogue/p1',
  }])
})

test('nav categories are distinct and do not load product prices', async () => {
  const client = fakeClient(() => ({
    data: [
      { category_id: 'c2', category: { id: 'c2', name: 'Wellness' } },
      { category_id: 'c2', category: { id: 'c2', name: 'Wellness' } },
      { category_id: 'c1', category: { id: 'c1', name: 'Drinkware' } },
    ],
    error: null,
  }))
  const categories = await readNavCategories(client as never)
  assert.equal(client.calls.length, 1)
  assert.equal(client.calls[0].select.includes('description'), false)
  assert.equal(client.calls[0].select.includes('product_costs'), false)
  assert.deepEqual(categories.map((category) => category.name), ['Drinkware', 'Wellness'])
})

test('sample-only products are left out of the public catalogue, search, and nav', async () => {
  const sample = {
    ...product,
    id: 'sample-1',
    name: 'Showroom sample',
    sample_only: true,
    category_id: 'c9',
    category: { id: 'c9', name: 'Samples' },
  }
  const catalogue = fakeClient(() => ({ data: [product, sample], error: null }))
  const rows = await loadPublicRows(catalogue as never, 'store')
  assert.deepEqual(rows.map((row) => row.id), ['p1'])

  const suggestions = fakeClient(() => ({ data: [product, sample], error: null }))
  const found = await readSearchSuggestions(suggestions as never)
  assert.deepEqual(found.map((row) => row.id), ['p1'])

  const nav = fakeClient(() => ({
    data: [
      { category_id: 'c1', sample_only: false, category: { id: 'c1', name: 'Drinkware' } },
      { category_id: 'c9', sample_only: true, category: { id: 'c9', name: 'Samples' } },
    ],
    error: null,
  }))
  const categories = await readNavCategories(nav as never)
  assert.deepEqual(categories.map((category) => category.name), ['Drinkware'])
})

test('anonymous public pages skip the proxy session lookup', () => {
  assert.equal(publicReadSkipsSession('store', '/catalogue'), true)
  assert.equal(publicReadSkipsSession('store', '/'), true)
  assert.equal(publicReadSkipsSession('admin', '/crm'), false)
  assert.equal(publicReadSkipsSession('tenant', '/portal/gifts'), false)
  assert.equal(hasAuthSessionCookie([{ name: 'gf-auth-tab.0', value: 'token' }]), true)
  assert.equal(hasAuthSessionCookie([{ name: 'gf-auth-recovery', value: 'token' }]), false)
  assert.equal(hasAuthSessionCookie([{ name: 'gf-auth-tab', value: '' }]), false)
})

test('product images on Supabase and the site are optimised, other hosts are not', () => {
  assert.equal(optimisedImageSrc('/site/home-welcome-kit.webp'), true)
  assert.equal(optimisedImageSrc('https://abc.supabase.co/storage/v1/object/public/product-images/a.webp'), true)
  assert.equal(optimisedImageSrc('https://cdn.example.com/logo.svg'), false)
  assert.equal(optimisedImageSrc('/logo.svg'), false)
})
