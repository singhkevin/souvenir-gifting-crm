import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPriceRounding,
  fixedPriceBlockReason,
  resolvePortalPrice,
  SEEDED_PORTAL_RULES,
  type PortalPriceInput,
  type PortalRule,
  type PricingPortal,
} from '../src/lib/pricing/engine.ts'

const today = new Date(2026, 9, 14)
const PORTALS: PricingPortal[] = ['store', 'business', 'corporate']
const rule = (portal: PricingPortal, patch: Partial<PortalRule> = {}): PortalRule => ({ ...SEEDED_PORTAL_RULES[portal], ...patch })

/** Every level set; each step below removes the winner so the next level shows. */
const everything: Omit<PortalPriceInput, 'portal' | 'rule'> = {
  quoteOverride: 77,
  specialPrice: 80,
  catalogManualPrice: 90,
  portalFixedPrice: 105,
  companyMarginPercent: 50,
  productMarginPercent: 30,
  costPrice: 40,
  today,
}

test('precedence: locked quote > company fixed > catalog manual > portal fixed > company margin > product margin > portal margin', () => {
  const corporate = (patch: Partial<PortalPriceInput>) =>
    resolvePortalPrice({ portal: 'corporate', rule: rule('corporate', { marginPercent: 10 }), ...everything, ...patch })

  assert.deepEqual([corporate({}).price, corporate({}).source], [77, 'override'])
  assert.deepEqual([corporate({ quoteOverride: null }).price, corporate({ quoteOverride: null }).source], [80, 'special'])
  const noSpecial = { quoteOverride: null, specialPrice: null }
  assert.deepEqual([corporate(noSpecial).price, corporate(noSpecial).source], [90, 'catalog'])
  const noCatalog = { ...noSpecial, catalogManualPrice: null }
  assert.deepEqual([corporate(noCatalog).price, corporate(noCatalog).source], [105, 'fixed'])
  const noFixed = { ...noCatalog, portalFixedPrice: null }
  assert.equal(corporate(noFixed).price, 60) // 40 + company 50%
  assert.equal(corporate(noFixed).marginPercent, 50)
  const noCompany = { ...noFixed, companyMarginPercent: null }
  assert.equal(corporate(noCompany).price, 52) // 40 + product 30%
  const noProduct = { ...noCompany, productMarginPercent: null }
  assert.equal(corporate(noProduct).price, 44) // 40 + portal 10%
  assert.equal(corporate(noProduct).source, 'rule')
})

test('a company margin of 0 still beats the product and portal margins', () => {
  const price = resolvePortalPrice({ portal: 'business', rule: rule('business', { marginPercent: 10 }), costPrice: 40, companyMarginPercent: 0, productMarginPercent: 30, today })
  assert.equal(price.price, 40)
})

test('a frozen quote price wins on every portal', () => {
  for (const portal of PORTALS) {
    const resolved = resolvePortalPrice({ portal, rule: rule(portal), ...everything })
    assert.equal(resolved.price, 77)
    assert.equal(resolved.source, 'override')
  }
})

test('store (Retail) ignores company prices and margins and catalog lines', () => {
  const store = resolvePortalPrice({ portal: 'store', rule: rule('store', { marginPercent: 10 }), ...everything, quoteOverride: null })
  assert.equal(store.price, 105) // portal fixed
  const noFixed = resolvePortalPrice({ portal: 'store', rule: rule('store', { marginPercent: 10 }), ...everything, quoteOverride: null, portalFixedPrice: null })
  assert.equal(noFixed.price, 52) // product margin 30%, company 50% ignored
  const plain = resolvePortalPrice({ portal: 'store', rule: rule('store', { marginPercent: 10 }), costPrice: 40, companyMarginPercent: 50, today })
  assert.equal(plain.price, 44)
})

test('business ignores catalog manual prices; expired fixed and special prices fall through', () => {
  const business = resolvePortalPrice({ portal: 'business', rule: rule('business', { marginPercent: 10 }), costPrice: 100, catalogManualPrice: 90, today })
  assert.equal(business.price, 110)
  const expired = resolvePortalPrice({
    portal: 'business',
    rule: rule('business', { marginPercent: 10 }),
    costPrice: 100,
    portalFixedPrice: 70,
    portalFixedValidUntil: '2026-10-13',
    specialPrice: 60,
    specialValidUntil: '2026-10-13',
    today,
  })
  assert.equal(expired.price, 110)
  assert.equal(expired.source, 'rule')
})

test('missing cost is price on quote, even with margins set', () => {
  for (const portal of PORTALS) {
    const resolved = resolvePortalPrice({ portal, rule: rule(portal, { marginPercent: 10 }), costPrice: null, productMarginPercent: 20, companyMarginPercent: 5, today })
    assert.equal(resolved.price, null, portal)
    assert.equal(resolved.source, 'on_quote', portal)
  }
  // A fixed price still prices a product with no cost.
  const fixed = resolvePortalPrice({ portal: 'corporate', rule: rule('corporate'), costPrice: null, portalFixedPrice: 500, today })
  assert.equal(fixed.price, 500)
})

test('seeded defaults: corporate margin 0% means price = cost', () => {
  assert.equal(SEEDED_PORTAL_RULES.corporate.marginPercent, 0)
  assert.equal(resolvePortalPrice({ portal: 'corporate', rule: SEEDED_PORTAL_RULES.corporate, costPrice: 123.45, today }).price, 123.45)
  // No portal margin at all: price = cost.
  assert.equal(resolvePortalPrice({ portal: 'business', rule: rule('business', { marginPercent: null }), costPrice: 80, today }).price, 80)
})

test('rounding changes the figure and the floor only warns', () => {
  assert.equal(applyPriceRounding(104.4, 'none'), 104.4)
  assert.equal(applyPriceRounding(104.5, 'whole'), 105)
  assert.equal(applyPriceRounding(104, 'end9'), 109)
  assert.equal(applyPriceRounding(1000, 'end99'), 999)
  assert.equal(applyPriceRounding(0, 'end9'), 0)

  const rounded = resolvePortalPrice({ portal: 'corporate', rule: rule('corporate', { marginPercent: 25, rounding: 'end9' }), costPrice: 100, today })
  assert.equal(rounded.price, 129)

  const under = resolvePortalPrice({
    portal: 'business',
    rule: rule('business', { minMarginPercent: 10, rounding: 'none', marginPercent: null }),
    costPrice: 95,
    portalFixedPrice: 100,
    today,
  })
  assert.equal(under.price, 100)
  assert.equal(under.belowFloor, true)
  assert.equal(fixedPriceBlockReason(100, 95, 10), 'That price is below cost plus the 10% minimum margin (floor 104.5).')
  assert.equal(fixedPriceBlockReason(105, 95, 10), null)
  assert.equal(fixedPriceBlockReason(1, null, 10), null)
})
