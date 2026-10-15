import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyCatalogueFilters,
  catalogueHref,
  readCatalogueFilters,
  priceBoundsOf,
} from '../src/lib/catalogue/catalogue-query.ts'
import { brandByPublicSlug, brandPath, brandPublicSlug, STORE_NAV_CATEGORIES } from '../src/lib/catalogue/store-nav.ts'
import { whatsAppHref } from '../src/lib/contact/public-phone.ts'
import type { PublicProduct } from '../src/lib/catalogue/products.ts'

function product(partial: Partial<PublicProduct> & Pick<PublicProduct, 'id' | 'name'>): PublicProduct {
  return {
    sku: partial.id,
    description: null,
    image_url: null,
    price: 100,
    moq: 1,
    category_id: null,
    category_name: null,
    brand_id: null,
    brand_name: null,
    brand_logo_url: null,
    occasion_tags: [],
    status: 'active',
    created_at: null,
    purchase: { buy: false, rfq: true, maxBuyQty: null, stockQty: 0 },
    ...partial,
  }
}

test('navbar keeps the six category labels in order', () => {
  assert.deepEqual(
    STORE_NAV_CATEGORIES.map((item) => item.label),
    ['Welcome Kits', 'Drinkware & Mugs', 'Bottles', 'Diaries & Notebooks', 'Apparel', 'Watches'],
  )
})

test('brand pages get a stable slug and stay unique when names collide', () => {
  const brands = [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Rare Rabbit' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Rare Rabbit' },
    { id: '33333333-3333-4333-8333-333333333333', name: 'Titan' },
  ]
  assert.equal(brandPublicSlug(brands[2], brands), 'titan')
  assert.notEqual(brandPublicSlug(brands[0], brands), brandPublicSlug(brands[1], brands))
  assert.equal(brandPath(brands[2], brands), '/brands/titan')
  assert.equal(brandByPublicSlug('titan', brands)?.id, brands[2].id)
  assert.equal(brandByPublicSlug(brandPublicSlug(brands[0], brands), brands)?.id, brands[0].id)
})

test('catalogue filters keep category, brand, price and occasion', () => {
  const products = [
    product({
      id: 'a',
      name: 'Flask',
      price: 400,
      category_id: '11111111-1111-4111-8111-111111111111',
      brand_id: '22222222-2222-4222-8222-222222222222',
      occasion_tags: ['festive'],
    }),
    product({
      id: 'b',
      name: 'Diary',
      price: 1200,
      category_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      brand_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      occasion_tags: ['welcome'],
    }),
  ]
  const bounds = priceBoundsOf(products)
  const filters = readCatalogueFilters({
    category: '11111111-1111-4111-8111-111111111111',
    brand: '22222222-2222-4222-8222-222222222222',
    occasion: 'festive',
    priceMax: '999',
  })
  const matched = applyCatalogueFilters(products, filters, bounds)
  assert.deepEqual(matched.map((item) => item.id), ['a'])
  assert.equal(
    catalogueHref('/home', filters, bounds, { occasion: '' }),
    '/home?category=11111111-1111-4111-8111-111111111111&brand=22222222-2222-4222-8222-222222222222&priceMax=999',
  )
})

test('whatsapp link is absent until a public phone is set', () => {
  assert.equal(whatsAppHref(''), null)
  assert.equal(whatsAppHref('   '), null)
})
