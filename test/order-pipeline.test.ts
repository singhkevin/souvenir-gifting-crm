import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPublicOrderToken, newPublicOrderToken, publicOrderTokenMatches } from '../src/lib/orders/public-token.ts'
import { isOrderSource, ORDER_SOURCES, resolveDirectOrderSource } from '../src/lib/orders/source.ts'
import { newestInvoiceStatus, paymentFilterKey, paymentLabel } from '../src/lib/orders/payment.ts'
import {
  assignCategoryId,
  findCategory,
  planMissingCategories,
  previewImportCategories,
} from '../src/lib/products/category-plan.ts'
import { storePublicOrigin } from '../src/lib/site/store-public-origin.ts'

test('order source allowlist rejects unknown values and limits client callers', () => {
  assert.deepEqual([...ORDER_SOURCES], ['store', 'business', 'portal', 'microsite', 'crm'])
  assert.equal(isOrderSource('store'), true)
  assert.equal(isOrderSource('catalog'), false)
  assert.equal(resolveDirectOrderSource({ requested: null, serviceRole: true, signedIn: false }), 'store')
  assert.equal(resolveDirectOrderSource({ requested: '  ', serviceRole: false, signedIn: true }), 'portal')
  assert.equal(resolveDirectOrderSource({ requested: 'microsite', serviceRole: false, signedIn: true }), 'microsite')
  assert.equal(resolveDirectOrderSource({ requested: 'business', serviceRole: true, signedIn: false }), 'business')
  assert.deepEqual(resolveDirectOrderSource({ requested: 'crm', serviceRole: false, signedIn: true }), {
    error: 'Not permitted to set this order source',
  })
  assert.deepEqual(resolveDirectOrderSource({ requested: 'shop', serviceRole: true, signedIn: false }), {
    error: 'Invalid order source',
  })
})

test('payment labels come from the newest invoice', () => {
  assert.equal(paymentLabel(null), 'No invoice')
  assert.equal(paymentLabel('cancelled'), 'No invoice')
  assert.equal(paymentLabel('issued'), 'Unpaid')
  assert.equal(paymentLabel('partially_paid'), 'Partially paid')
  assert.equal(paymentFilterKey('paid'), 'paid')
  assert.equal(newestInvoiceStatus([
    { status: 'issued', created_at: '2026-01-01' },
    { status: 'paid', created_at: '2026-02-01' },
  ]), 'paid')
})

test('public order token matches only its hash', () => {
  const minted = newPublicOrderToken()
  assert.equal(minted.hash, hashPublicOrderToken(minted.token))
  assert.equal(publicOrderTokenMatches(minted.token, minted.hash), true)
  assert.equal(publicOrderTokenMatches(minted.token, hashPublicOrderToken('other')), false)
  assert.equal(publicOrderTokenMatches('', minted.hash), false)
})

test('createCategory lookup dedupes case and aliases', () => {
  const rows = [{ id: 'bags', name: 'Bags & Travel' }, { id: 'desk', name: 'Desk & Stationery' }]
  assert.equal(findCategory(rows, '  bags   &   travel ')?.id, 'bags')
  assert.equal(findCategory(rows, 'BAGS')?.id, 'bags')
  assert.equal(findCategory(rows, 'stationery')?.id, 'desk')
  assert.equal(findCategory(rows, 'New Line'), null)
})

test('import preview lists each new category once', () => {
  const existing = [{ id: 'bags', name: 'Bags & Travel' }]
  const preview = previewImportCategories({
    createMissing: true,
    existing,
    rows: [
      { row: 2, sku: 'A', name: 'Pen', category: 'bags', price: '10' },
      { row: 3, sku: 'B', name: 'Note', category: 'Eco Gifts', price: '12' },
      { row: 4, sku: 'C', name: 'Card', category: 'eco   gifts', price: '8' },
      { row: 5, sku: '', name: '', category: 'Skipped', price: '' },
    ],
  })
  assert.deepEqual(preview.categories, ['Eco Gifts'])
  assert.deepEqual(preview.failures, [])
})

test('import assigns created categories and keeps missing categories as errors without the flag', () => {
  const existing = [{ id: 'bags', name: 'Bags & Travel' }]
  const blocked = previewImportCategories({
    createMissing: false,
    existing,
    rows: [{ row: 2, sku: 'A', name: 'Pen', category: 'Eco Gifts', price: '10' }],
  })
  assert.deepEqual(blocked.categories, [])
  assert.equal(blocked.failures[0]?.reason, 'Category not found: Eco Gifts')

  const toCreate = planMissingCategories(existing, ['Eco Gifts', 'eco gifts', 'bags'])
  assert.deepEqual(toCreate, ['Eco Gifts'])
  const rows = [...existing, { id: 'eco', name: toCreate[0] }]
  assert.equal(assignCategoryId(rows, 'bags'), 'bags')
  assert.equal(assignCategoryId(rows, 'ECO GIFTS'), 'eco')
})

test('store sitemap origin uses www.souvenirgifting.com', () => {
  const prev = {
    DOMAIN_SPLIT: process.env.DOMAIN_SPLIT,
    STORE_DOMAIN: process.env.STORE_DOMAIN,
    ROOT_DOMAIN: process.env.ROOT_DOMAIN,
  }
  process.env.DOMAIN_SPLIT = '1'
  process.env.STORE_DOMAIN = 'souvenirgifting.com'
  process.env.ROOT_DOMAIN = 'giftingstore.online'
  try {
    assert.equal(storePublicOrigin('www.souvenirgifting.com'), 'https://www.souvenirgifting.com')
    assert.equal(storePublicOrigin('souvenirgifting.com'), 'https://www.souvenirgifting.com')
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
