import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CATALOGUE_ROW_CAP,
  PICKER_RESULT_LIMIT,
  dropdownLocksUp,
  namesKeptByRowCap,
  productMatchesQuery,
  productSearchOrFilter,
  sanitizeProductSearch,
} from '../src/lib/requirements/product-search.ts'

test('the old catalogue dropdown locks up and drops products past the row cap', () => {
  const rows = [
    ...Array.from({ length: CATALOGUE_ROW_CAP }, (_, index) => ({
      id: `p${index}`,
      name: `Item ${String(index).padStart(4, '0')}`,
      sku: `SKU-${index}`,
    })),
    { id: 'late', name: 'Zebra Bottle', sku: 'ZB-9' },
  ]
  const shown = namesKeptByRowCap(rows)
  assert.equal(shown.length, CATALOGUE_ROW_CAP)
  assert.equal(dropdownLocksUp(shown.length), true)
  assert.equal(shown.some((row) => row.sku === 'ZB-9'), false)
  assert.equal(productMatchesQuery({ name: 'Zebra Bottle', sku: 'ZB-9' }, 'zb-9'), true)
  assert.equal(dropdownLocksUp(PICKER_RESULT_LIMIT), false)
  assert.ok(PICKER_RESULT_LIMIT < CATALOGUE_ROW_CAP)
})

test('search matches name or sku and ignores a blank query', () => {
  const product = { name: 'North Steel Bottle', sku: 'NS-14' }
  assert.equal(productMatchesQuery(product, 'steel'), true)
  assert.equal(productMatchesQuery(product, 'ns-14'), true)
  assert.equal(productMatchesQuery(product, 'mug'), false)
  assert.equal(productMatchesQuery(product, '   '), true)
})

test('the or filter is quoted and empty after stripping wildcards', () => {
  assert.equal(sanitizeProductSearch('  north, steel* '), 'north steel')
  assert.equal(productSearchOrFilter('AB.12'), 'name.ilike."%AB.12%",sku.ilike."%AB.12%"')
  assert.equal(productSearchOrFilter('***'), null)
  assert.equal(productSearchOrFilter('a,b'), 'name.ilike."%a b%",sku.ilike."%a b%"')
})
