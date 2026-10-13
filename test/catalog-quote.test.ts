import assert from 'node:assert/strict'
import test from 'node:test'
import { budgetBadge, clampQuoteQty, normalizeMoq, quoteEstimate } from '../src/lib/portal/catalog-quote.ts'

test('normalizeMoq falls back to 1', () => {
  assert.equal(normalizeMoq(null), 1)
  assert.equal(normalizeMoq(0), 1)
  assert.equal(normalizeMoq(25), 25)
})

test('clampQuoteQty never goes below MOQ', () => {
  assert.equal(clampQuoteQty(1, 25), 25)
  assert.equal(clampQuoteQty(25, 25), 25)
  assert.equal(clampQuoteQty(40.4, 25), 40)
  assert.equal(clampQuoteQty(Number.NaN, 10), 10)
  assert.equal(clampQuoteQty(200000, 1), 100000)
})

test('budgetBadge is within or over whenever a budget is set', () => {
  assert.equal(budgetBadge(2500, 3000), 'within')
  assert.equal(budgetBadge(3000, 3000), 'within')
  assert.equal(budgetBadge(3500, 3000), 'over')
  assert.equal(budgetBadge(null, 3000), 'over')
  assert.equal(budgetBadge(2500, null), null)
  assert.equal(budgetBadge(2500, 0), null)
})

test('quoteEstimate sums priced lines and counts missing prices', () => {
  assert.deepEqual(quoteEstimate([
    { price: 100, quantity: 25 },
    { price: null, quantity: 10 },
  ]), { total: 2500, unpriced: 1 })
})
