import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPriceRounding,
  fixedPriceBlockReason,
  resolvePortalPrice,
  SEEDED_PORTAL_RULES,
  type PortalRule,
  type PricingPortal,
} from '../src/lib/pricing/engine.ts'
import { surfaceUnitPrice } from '../src/lib/pricing/listed.ts'

const today = new Date(2026, 9, 14)

test('seeded rules match the prices every surface shows today', () => {
  const retails = [null, 0, 10, 99.99, 100, 750.5, 1299]
  const costs = [null, 0, 40, 80]
  const margins = [null, 0, 10, 35, 40]
  const specials = [null, 0, 80]
  const manuals = [null, 90]
  const untils = [null, '2026-10-14', '2026-10-13', 'not-a-date']

  for (const retailPrice of retails) {
    for (const costPrice of costs) {
      for (const companyMarginPercent of margins) {
        for (const specialPrice of specials) {
          for (const catalogManualPrice of manuals) {
            for (const specialValidUntil of untils) {
              const shared = {
                retailPrice,
                costPrice,
                companyMarginPercent,
                specialPrice,
                specialValidUntil,
                catalogManualPrice,
                today,
              }
              const store = resolvePortalPrice({ portal: 'store', rule: SEEDED_PORTAL_RULES.store, ...shared })
              assert.equal(
                store.price,
                surfaceUnitPrice({ channel: 'b2c', retailPrice, today }),
                `store retail ${retailPrice}`,
              )
              assert.equal(store.source, 'rule')

              const business = resolvePortalPrice({ portal: 'business', rule: SEEDED_PORTAL_RULES.business, ...shared })
              assert.equal(
                business.price,
                surfaceUnitPrice({
                  channel: 'b2b',
                  retailPrice,
                  specialPrice,
                  specialValidUntil,
                  companyMarginPercent,
                  today,
                }),
                `business ${JSON.stringify(shared)}`,
              )

              const corporate = resolvePortalPrice({ portal: 'corporate', rule: SEEDED_PORTAL_RULES.corporate, ...shared })
              assert.equal(
                corporate.price,
                surfaceUnitPrice({
                  channel: 'b2b',
                  retailPrice,
                  specialPrice,
                  specialValidUntil,
                  catalogManualPrice,
                  companyMarginPercent,
                  today,
                }),
                `corporate ${JSON.stringify(shared)}`,
              )
            }
          }
        }
      }
    }
  }
})

test('a frozen quote price wins and is not recomputed', () => {
  for (const portal of ['store', 'business', 'corporate'] as PricingPortal[]) {
    const resolved = resolvePortalPrice({
      portal,
      rule: SEEDED_PORTAL_RULES[portal],
      retailPrice: 100,
      specialPrice: 80,
      catalogManualPrice: 90,
      companyMarginPercent: 10,
      quoteOverride: 77,
      today,
    })
    assert.equal(resolved.price, 77)
    assert.equal(resolved.source, 'override')
  }
})

test('portal fixed price sits under special and catalog, and above the rule', () => {
  const rule = SEEDED_PORTAL_RULES.corporate
  const withFixed = resolvePortalPrice({
    portal: 'corporate',
    rule,
    retailPrice: 100,
    companyMarginPercent: 10,
    portalFixedPrice: 105,
    today,
  })
  assert.equal(withFixed.price, 105)
  assert.equal(withFixed.source, 'fixed')

  const specialWins = resolvePortalPrice({
    portal: 'corporate',
    rule,
    retailPrice: 100,
    specialPrice: 80,
    portalFixedPrice: 105,
    today,
  })
  assert.equal(specialWins.price, 80)
  assert.equal(specialWins.source, 'special')

  const catalogWins = resolvePortalPrice({
    portal: 'corporate',
    rule,
    retailPrice: 100,
    catalogManualPrice: 90,
    portalFixedPrice: 105,
    today,
  })
  assert.equal(catalogWins.price, 90)
  assert.equal(catalogWins.source, 'catalog')

  const expired = resolvePortalPrice({
    portal: 'business',
    rule: SEEDED_PORTAL_RULES.business,
    retailPrice: 100,
    portalFixedPrice: 70,
    portalFixedValidUntil: '2026-10-13',
    today,
  })
  assert.equal(expired.price, 100)
  assert.equal(expired.source, 'rule')

  const businessIgnoresCatalog = resolvePortalPrice({
    portal: 'business',
    rule: SEEDED_PORTAL_RULES.business,
    retailPrice: 100,
    catalogManualPrice: 90,
    today,
  })
  assert.equal(businessIgnoresCatalog.price, 100)
})

test('cost base, store auto-from-cost, and the no-cost fallback', () => {
  const costRule: PortalRule = { ...SEEDED_PORTAL_RULES.business, base: 'cost', marginPercent: 25 }
  const fromCost = resolvePortalPrice({
    portal: 'business',
    rule: costRule,
    retailPrice: 100,
    costPrice: 40,
    today,
  })
  assert.equal(fromCost.price, 50)
  assert.equal(fromCost.source, 'rule')

  const companyMarginWins = resolvePortalPrice({
    portal: 'business',
    rule: costRule,
    retailPrice: 100,
    costPrice: 40,
    companyMarginPercent: 50,
    today,
  })
  assert.equal(companyMarginWins.price, 60)
  assert.equal(companyMarginWins.marginPercent, 50)

  const retailFallback = resolvePortalPrice({
    portal: 'corporate',
    rule: { ...SEEDED_PORTAL_RULES.corporate, base: 'cost', marginPercent: 10, noCostFallback: 'retail_margin' },
    retailPrice: 100,
    costPrice: null,
    today,
  })
  assert.equal(retailFallback.price, 110)
  assert.equal(retailFallback.source, 'rule')

  const onQuote = resolvePortalPrice({
    portal: 'corporate',
    rule: { ...SEEDED_PORTAL_RULES.corporate, base: 'cost', marginPercent: 10, noCostFallback: 'on_quote' },
    retailPrice: 100,
    costPrice: null,
    today,
  })
  assert.equal(onQuote.price, null)
  assert.equal(onQuote.source, 'on_quote')

  const storeRetail = resolvePortalPrice({
    portal: 'store',
    rule: { ...SEEDED_PORTAL_RULES.store, marginPercent: 40, base: 'retail' },
    retailPrice: 100,
    costPrice: 40,
    companyMarginPercent: 80,
    specialPrice: 10,
    today,
  })
  assert.equal(storeRetail.price, 100)

  const storeFromCost = resolvePortalPrice({
    portal: 'store',
    rule: { ...SEEDED_PORTAL_RULES.store, base: 'cost', marginPercent: 50 },
    retailPrice: 100,
    costPrice: 40,
    today,
  })
  assert.equal(storeFromCost.price, 60)

  const storeMissingCost = resolvePortalPrice({
    portal: 'store',
    rule: { ...SEEDED_PORTAL_RULES.store, base: 'cost', marginPercent: 50, noCostFallback: 'on_quote' },
    retailPrice: 100,
    costPrice: null,
    today,
  })
  assert.equal(storeMissingCost.price, null)
})

test('rounding changes the figure and the floor only warns', () => {
  assert.equal(applyPriceRounding(104.4, 'none'), 104.4)
  assert.equal(applyPriceRounding(104.5, 'whole'), 105)
  assert.equal(applyPriceRounding(104, 'end9'), 109)
  assert.equal(applyPriceRounding(1000, 'end99'), 999)
  assert.equal(applyPriceRounding(0, 'end9'), 0)

  const under = resolvePortalPrice({
    portal: 'business',
    rule: { ...SEEDED_PORTAL_RULES.business, minMarginPercent: 10, rounding: 'none' },
    retailPrice: 100,
    costPrice: 95,
    today,
  })
  assert.equal(under.price, 100)
  assert.equal(under.belowFloor, true)
  assert.equal(fixedPriceBlockReason(100, 95, 10), 'That price is below cost plus the 10% minimum margin (floor 104.5).')
  assert.equal(fixedPriceBlockReason(105, 95, 10), null)
  assert.equal(fixedPriceBlockReason(1, null, 10), null)
})
