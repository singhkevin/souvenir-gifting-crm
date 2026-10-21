import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAmount, resolveCostAndRetail, resolveCsvRetail, retailFromCost } from '../src/lib/products/cost-price.ts'

test('cost price alone sets retail = cost', () => {
  assert.deepEqual(resolveCostAndRetail({ cost: '450' }), { ok: true, cost: 450, price: 450 })
  assert.deepEqual(resolveCostAndRetail({ cost: '450', retailOverride: '' }), { ok: true, cost: 450, price: 450 })
})

test('a retail override replaces the cost as retail', () => {
  assert.deepEqual(resolveCostAndRetail({ cost: '80', retailOverride: '220' }), { ok: true, cost: 80, price: 220 })
  assert.equal(retailFromCost(80, null), 80)
})

test('cost price is required and must be valid', () => {
  assert.equal(resolveCostAndRetail({ cost: '' }).ok, false)
  assert.equal(resolveCostAndRetail({ cost: '0' }).ok, false)
  assert.equal(resolveCostAndRetail({ cost: 'abc' }).ok, false)
  assert.equal(resolveCostAndRetail({ cost: '-5' }).ok, false)
  assert.equal(resolveCostAndRetail({ cost: '10', retailOverride: 'x' }).ok, false)
})

test('amounts round to paise', () => {
  assert.deepEqual(parseAmount('12.345'), { ok: true, value: 12.35 })
  assert.deepEqual(parseAmount(' '), { ok: true, value: null })
})

test('CSV: blank price falls back to cost, blank both fails', () => {
  assert.deepEqual(resolveCsvRetail({ priceRaw: '', cost: 300 }), { ok: true, price: 300 })
  assert.deepEqual(resolveCsvRetail({ priceRaw: '499', cost: 300 }), { ok: true, price: 499 })
  assert.equal(resolveCsvRetail({ priceRaw: '', cost: null }).ok, false)
  assert.equal(resolveCsvRetail({ priceRaw: 'abc', cost: 300 }).ok, false)
})
