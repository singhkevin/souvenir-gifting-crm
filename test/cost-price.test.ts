import assert from 'node:assert/strict'
import test from 'node:test'
import { legacyPriceForInsert, parseAmount, resolveCost, resolveCsvCost } from '../src/lib/products/cost-price.ts'

test('cost price is required, above zero, and rounds to paise', () => {
  assert.deepEqual(resolveCost('450'), { ok: true, cost: 450 })
  assert.deepEqual(resolveCost('12.345'), { ok: true, cost: 12.35 })
  assert.equal(resolveCost('').ok, false)
  assert.equal(resolveCost('0').ok, false)
  assert.equal(resolveCost('abc').ok, false)
  assert.equal(resolveCost('-5').ok, false)
})

test('amounts round to paise and blank is null', () => {
  assert.deepEqual(parseAmount('12.345'), { ok: true, value: 12.35 })
  assert.deepEqual(parseAmount(' '), { ok: true, value: null })
  assert.deepEqual(parseAmount('-1'), { ok: false })
})

test('frozen products.price gets the cost on insert, else 0', () => {
  assert.equal(legacyPriceForInsert(450), 450)
  assert.equal(legacyPriceForInsert(null), 0)
  assert.equal(legacyPriceForInsert(Number.NaN), 0)
})

test('CSV: cost column wins, an old price column is read as cost, blank both fails', () => {
  assert.deepEqual(resolveCsvCost({ cost: 300, priceRaw: '499', allowCosts: true }), { ok: true, cost: 300 })
  assert.deepEqual(resolveCsvCost({ cost: null, priceRaw: '499', allowCosts: true }), { ok: true, cost: 499 })
  assert.equal(resolveCsvCost({ cost: null, priceRaw: '', allowCosts: true }).ok, false)
  assert.equal(resolveCsvCost({ cost: null, priceRaw: 'abc', allowCosts: true }).ok, false)
  assert.equal(resolveCsvCost({ cost: -1, priceRaw: '', allowCosts: true }).ok, false)
})

test('CSV: accounts without cost access import with no cost (price on quote)', () => {
  assert.deepEqual(resolveCsvCost({ cost: null, priceRaw: '499', allowCosts: false }), { ok: true, cost: null })
})
