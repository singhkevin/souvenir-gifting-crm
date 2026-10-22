import assert from 'node:assert/strict'
import test from 'node:test'
import { effectiveCost, parseCostSource, parsePortalCostSource, resolveCostSource } from '../src/lib/pricing/cost-basis.ts'
import { SEEDED_PORTAL_RULES } from '../src/lib/pricing/engine.ts'
import { portalRuleFromRow } from '../src/lib/pricing/surfaces.ts'
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
  assert.deepEqual(effectiveCost({ source: 'manual', manualCost: 80, offers, requireInStock: true }), { cost: 80, from: 'manual', offerId: null, basis: 'manual' })
  assert.deepEqual(effectiveCost({ source: null, manualCost: 80, offers, requireInStock: true }).cost, 80)
  assert.deepEqual(effectiveCost({ source: 'manual', manualCost: null, offers, requireInStock: true }), { cost: null, from: 'none', offerId: null, basis: 'manual' })
})

test('preferred supplier uses the pinned offer only when it is eligible', () => {
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers, quantity: 100, requireInStock: true }).offerId, 'pinned')
  // Below the pinned offer MOQ: back to manual.
  assert.deepEqual(effectiveCost({ source: 'preferred', manualCost: 80, offers, quantity: 60, requireInStock: true }), { cost: 80, from: 'manual', offerId: null, basis: 'preferred' })
  // No quantity: the product MOQ decides.
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers, productMoq: 100, requireInStock: true }).cost, 90)
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers, productMoq: 10, requireInStock: true }).cost, 80)
  const outOfStock = [offer({ id: 'pinned-out', cost: 60, is_preferred: true, in_stock: false })]
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers: outOfStock, requireInStock: true }).cost, 80)
  assert.equal(effectiveCost({ source: 'preferred', manualCost: 80, offers: outOfStock, requireInStock: false }).cost, 60)
})

test('lowest eligible offer respects MOQ <= qty, stock and active, and a pinned offer wins', () => {
  // qty 60: cheap-big-moq (MOQ 500) and pinned (MOQ 100) are not eligible; out/inactive never are.
  assert.deepEqual(effectiveCost({ source: 'lowest', manualCost: 80, offers, quantity: 60, requireInStock: true }), { cost: 70, from: 'offer', offerId: 'mid', basis: 'lowest' })
  // qty 500: the pinned offer is eligible and wins over the cheaper one.
  assert.equal(effectiveCost({ source: 'lowest', manualCost: 80, offers, quantity: 500, requireInStock: true }).offerId, 'pinned')
  // Stock not required: the out-of-stock 40 is the lowest at qty 1.
  assert.equal(effectiveCost({ source: 'lowest', manualCost: 80, offers: offers.filter((row) => !row.is_preferred), quantity: 1, requireInStock: false }).cost, 40)
  // Nothing eligible: manual.
  assert.equal(effectiveCost({ source: 'lowest', manualCost: 80, offers, quantity: 1, requireInStock: true }).cost, 80)
  assert.equal(effectiveCost({ source: 'lowest', manualCost: null, offers: [], requireInStock: true }).from, 'none')
})

test('portal default: a product on portal_default follows each portal rule; its own choice overrides every portal', () => {
  assert.equal(resolveCostSource('portal_default', 'lowest'), 'lowest')
  assert.equal(resolveCostSource('portal_default', null), 'manual')
  assert.equal(resolveCostSource(undefined, 'preferred'), 'preferred')
  for (const portalDefault of ['manual', 'preferred', 'lowest'] as const) {
    assert.equal(resolveCostSource('manual', portalDefault), 'manual')
    assert.equal(resolveCostSource('lowest', portalDefault), 'lowest')
  }
  // Same product, three portals with different defaults (qty 60): manual 80, pinned not eligible -> 80, lowest -> 70.
  const byPortal = (['manual', 'preferred', 'lowest'] as const).map((portalDefault) =>
    effectiveCost({ source: 'portal_default', portalDefault, manualCost: 80, offers, quantity: 60, requireInStock: true }))
  assert.deepEqual(byPortal.map((row) => [row.basis, row.cost]), [['manual', 80], ['preferred', 80], ['lowest', 70]])
  // A product override ignores the portal default.
  assert.equal(effectiveCost({ source: 'manual', portalDefault: 'lowest', manualCost: 80, offers, quantity: 60, requireInStock: true }).cost, 80)
  assert.equal(effectiveCost({ source: 'lowest', portalDefault: 'manual', manualCost: 80, offers, quantity: 60, requireInStock: true }).cost, 70)
  // Day one: every portal default is manual, so portal_default products keep their stored cost.
  for (const portal of ['store', 'business', 'corporate'] as const) {
    assert.equal(SEEDED_PORTAL_RULES[portal].costSource, 'manual')
    assert.equal(effectiveCost({ source: 'portal_default', portalDefault: SEEDED_PORTAL_RULES[portal].costSource, manualCost: 80, offers, requireInStock: true }).cost, 80)
  }
})

test('portal rules read their default cost source from org_settings (missing = manual)', () => {
  assert.equal(portalRuleFromRow({ business_default_cost_source: 'lowest' }, 'business').costSource, 'lowest')
  assert.equal(portalRuleFromRow({ corporate_default_cost_source: 'preferred' }, 'corporate').costSource, 'preferred')
  assert.equal(portalRuleFromRow({}, 'store').costSource, 'manual')
  assert.equal(portalRuleFromRow({ store_default_cost_source: 'portal_default' }, 'store').costSource, 'manual')
})

test('cost source parsing', () => {
  assert.deepEqual(parseCostSource(''), { ok: true, value: 'portal_default' })
  assert.deepEqual(parseCostSource('portal_default'), { ok: true, value: 'portal_default' })
  assert.deepEqual(parseCostSource('Use portal default'), { ok: true, value: 'portal_default' })
  assert.deepEqual(parseCostSource('preferred_supplier'), { ok: true, value: 'preferred' })
  assert.deepEqual(parseCostSource('lowest_offer'), { ok: true, value: 'lowest' })
  assert.deepEqual(parsePortalCostSource(''), { ok: true, value: 'manual' })
  assert.deepEqual(parsePortalCostSource('lowest_offer'), { ok: true, value: 'lowest' })
  assert.equal(parsePortalCostSource('portal_default').ok, false)
  assert.deepEqual(parseCostSource('manual'), { ok: true, value: 'manual' })
  assert.deepEqual(parseCostSource(' Preferred Supplier '), { ok: true, value: 'preferred' })
  assert.deepEqual(parseCostSource('lowest'), { ok: true, value: 'lowest' })
  assert.deepEqual(parseCostSource('best'), { ok: true, value: 'lowest' })
  assert.equal(parseCostSource('retail').ok, false)
})
