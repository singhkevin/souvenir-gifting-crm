import assert from 'node:assert/strict'
import test from 'node:test'
import { effectiveCost, parseCostSource } from '../src/lib/pricing/cost-basis.ts'
import type { SupplierOffer } from '../src/lib/pricing/offers.ts'

function offer(partial: Partial<SupplierOffer> & { id: string; cost: number }): SupplierOffer {
  return {
    product_id: 'p',
    supplier_id: `s-${partial.id}`,
    supplier_sku: null,
    moq: 1,
    lead_time_days: null,
    in_stock: true,
    is_active: true,
    is_preferred: false,
    ...partial,
  }
}

const offers = [
  offer({ id: 'cheap-big-moq', cost: 50, moq: 500 }),
  offer({ id: 'mid', cost: 70, moq: 50 }),
  offer({ id: 'pinned', cost: 90, moq: 100, is_preferred: true }),
  offer({ id: 'out', cost: 40, moq: 1, in_stock: false }),
  offer({ id: 'inactive', cost: 30, moq: 1, is_active: false }),
]

test('manual cost source ignores offers', () => {
  assert.deepEqual(effectiveCost({ source: 'manual', manualCost: 80, offers, requireInStock: true }), { cost: 80, from: 'manual', offerId: null })
  assert.deepEqual(effectiveCost({ source: null, manualCost: 80, offers, requireInStock: true }).cost, 80)
  assert.deepEqual(effectiveCost({ source: 'manual', manualCost: null, offers, requireInStock: true }), { cost: null, from: 'none', offerId: null })
})

test('preferred supplier uses the pinned offer only when it is eligible', () => {
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers, quantity: 100, requireInStock: true }).offerId, 'pinned')
  // Below the pinned offer MOQ: back to manual.
  assert.deepEqual(effectiveCost({ source: 'preferred', manualCost: 80, offers, quantity: 60, requireInStock: true }), { cost: 80, from: 'manual', offerId: null })
  // No quantity: the product MOQ decides.
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers, productMoq: 100, requireInStock: true }).cost, 90)
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers, productMoq: 10, requireInStock: true }).cost, 80)
  const outOfStock = [offer({ id: 'pinned-out', cost: 60, is_preferred: true, in_stock: false })]
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers: outOfStock, requireInStock: true }).cost, 80)
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers: outOfStock, requireInStock: false }).cost, 60)
})

test('lowest eligible offer respects MOQ <= qty, stock and active, and a pinned offer wins', () => {
  // qty 60: cheap-big-moq (MOQ 500) and pinned (MOQ 100) are not eligible; out/inactive never are.
  assert.deepEqual(effectiveCost({ source: 'lowest', manualCost: 80, offers, quantity: 60, requireInStock: true }), { cost: 70, from: 'offer', offerId: 'mid' })
  // qty 500: the pinned offer is eligible and wins over the cheaper one.
  assert.equal(effectiveCost({ source: 'lowest', manualCost: 80, offers, quantity: 500, requireInStock: true }).offerId, 'pinned')
  // Stock not required: the out-of-stock 40 is the lowest at qty 1.
  assert.equal(effectiveCost({ source: 'lowest', manualCost: 80, offers: offers.filter((row) => !row.is_preferred), quantity: 1, requireInStock: false }).cost, 40)
  // Nothing eligible: manual.
  assert.equal(effectiveCost({ source: 'lowest', manualCost: 80, offers, quantity: 1, requireInStock: true }).cost, 80)
  assert.equal(effectiveCost({ source: 'lowest', manualCost: null, offers: [], requireInStock: true }).from, 'none')
})

test('cost source parsing', () => {
  assert.deepEqual(parseCostSource(''), { ok: true, value: 'manual' })
  assert.deepEqual(parseCostSource(' Preferred Supplier '), { ok: true, value: 'preferred' })
  assert.deepEqual(parseCostSource('lowest'), { ok: true, value: 'lowest' })
  assert.deepEqual(parseCostSource('best'), { ok: true, value: 'lowest' })
  assert.equal(parseCostSource('retail').ok, false)
})
