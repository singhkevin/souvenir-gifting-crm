import assert from 'node:assert/strict'
import test from 'node:test'
import { listedUnitPrice, specialPriceActive } from '../src/lib/pricing/listed.ts'

const today = new Date(2026, 9, 14)

test('listed price prefers a current company special', () => {
  assert.equal(specialPriceActive(null, today), true)
  assert.equal(specialPriceActive('2026-10-14', today), true)
  assert.equal(specialPriceActive('2026-10-13', today), false)
  assert.equal(
    listedUnitPrice({
      specialPrice: 80,
      specialValidUntil: '2026-10-14',
      catalogManualPrice: 90,
      basePrice: 100,
      companyMarginPercent: 10,
      today,
    }),
    80,
  )
  assert.equal(
    listedUnitPrice({
      specialPrice: 80,
      specialValidUntil: '2026-10-13',
      catalogManualPrice: 90,
      basePrice: 100,
      companyMarginPercent: 10,
      today,
    }),
    90,
  )
})

test('listed price uses base plus company margin when nothing else is set', () => {
  assert.equal(
    listedUnitPrice({ basePrice: 100, companyMarginPercent: 10, today }),
    110,
  )
  assert.equal(listedUnitPrice({ basePrice: 100, companyMarginPercent: null, today }), 100)
  assert.equal(listedUnitPrice({ basePrice: null, companyMarginPercent: null, today }), 0)
})
