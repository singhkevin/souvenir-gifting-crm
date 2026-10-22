import assert from 'node:assert/strict'
import test from 'node:test'
import { specialPriceActive } from '../src/lib/pricing/listed.ts'

const today = new Date(2026, 9, 14)

test('a special price is active through its end date and with no end date', () => {
  assert.equal(specialPriceActive(null, today), true)
  assert.equal(specialPriceActive('2026-10-14', today), true)
  assert.equal(specialPriceActive('2026-10-13', today), false)
  assert.equal(specialPriceActive('not-a-date', today), true)
})
