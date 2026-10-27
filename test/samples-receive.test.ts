import assert from 'node:assert/strict'
import test from 'node:test'
import {
  initialOfficeQuantity,
  matchesSampleSearch,
  parseSampleQty,
  planReceiveIntoOffice,
} from '../src/lib/samples/ledger.ts'

test('receive into office squares off the client and restocks the office', () => {
  const plan = planReceiveIntoOffice({ quantity: 1, heldByClient: 2, inOffice: 3, withClient: 4 })
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  assert.equal(plan.inOffice, 4)
  assert.equal(plan.withClient, 3)
  assert.equal(plan.heldByClient, 1)
})

test('receive rejects a quantity above what that client holds', () => {
  const plan = planReceiveIntoOffice({ quantity: 3, heldByClient: 2, inOffice: 0, withClient: 5 })
  assert.deepEqual(plan, { ok: false, error: 'That client holds 2.' })
})

test('receive rejects a client who holds nothing', () => {
  const plan = planReceiveIntoOffice({ quantity: 1, heldByClient: 0, inOffice: 4, withClient: 1 })
  assert.equal(plan.ok, false)
  if (plan.ok) return
  assert.match(plan.error, /not holding/)
})

test('receive rejects a quantity above the with-client total', () => {
  const plan = planReceiveIntoOffice({ quantity: 2, heldByClient: 2, inOffice: 0, withClient: 1 })
  assert.equal(plan.ok, false)
  if (plan.ok) return
  assert.match(plan.error, /with clients/)
})

test('receive rejects zero, fractions, and negatives', () => {
  for (const quantity of [0, -1, 1.5, Number.NaN]) {
    const plan = planReceiveIntoOffice({ quantity, heldByClient: 3, inOffice: 1, withClient: 3 })
    assert.equal(plan.ok, false)
    if (plan.ok) return
    assert.match(plan.error, /whole quantity/)
  }
})

test('sample only with a blank quantity uses stock on hand, including zero', () => {
  assert.equal(initialOfficeQuantity({ sampleOnly: true, sampleQty: null, stockQty: 4 }), 4)
  assert.equal(initialOfficeQuantity({ sampleOnly: true, sampleQty: null, stockQty: 0 }), 0)
  assert.equal(initialOfficeQuantity({ sampleOnly: true, sampleQty: 2, stockQty: 9 }), 2)
})

test('a positive sample quantity seeds stock even when the product is sellable', () => {
  assert.equal(initialOfficeQuantity({ sampleOnly: false, sampleQty: 3, stockQty: 20 }), 3)
  assert.equal(initialOfficeQuantity({ sampleOnly: false, sampleQty: null, stockQty: 20 }), null)
  assert.equal(initialOfficeQuantity({ sampleOnly: false, sampleQty: 0, stockQty: 20 }), null)
})

test('sample quantity must be a whole number', () => {
  assert.deepEqual(parseSampleQty(''), { ok: true, value: null })
  assert.deepEqual(parseSampleQty('2'), { ok: true, value: 2 })
  const bad = parseSampleQty('1.5')
  assert.equal(bad.ok, false)
})

test('sample search matches product name, sku, and holder', () => {
  const fields = ['North Steel Bottle', 'NSB-1', 'Analytical Wizard', null]
  assert.equal(matchesSampleSearch('north', fields), true)
  assert.equal(matchesSampleSearch('nsb', fields), true)
  assert.equal(matchesSampleSearch('wizard', fields), true)
  assert.equal(matchesSampleSearch('missing', fields), false)
  assert.equal(matchesSampleSearch('  ', fields), true)
})
