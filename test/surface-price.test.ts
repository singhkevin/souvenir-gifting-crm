import assert from 'node:assert/strict'
import test from 'node:test'
import { surfaceUnitPrice } from '../src/lib/pricing/listed.ts'

const today = new Date(2026, 9, 14)

const ladder = {
  retailPrice: 100,
  specialPrice: 80,
  specialValidUntil: '2026-10-14',
  catalogManualPrice: 90,
  companyMarginPercent: 10,
  today,
}

test('store, orders, emails and pdfs share one price function', () => {
  assert.equal(surfaceUnitPrice({ channel: 'b2c', ...ladder }), 100)
  assert.equal(surfaceUnitPrice({ channel: 'b2b', ...ladder }), 80)
  assert.equal(
    surfaceUnitPrice({ ...ladder, channel: 'b2b', specialValidUntil: '2026-10-13' }),
    90,
  )
  assert.equal(
    surfaceUnitPrice({
      channel: 'b2b',
      retailPrice: 100,
      companyMarginPercent: 10,
      today,
    }),
    110,
  )
  const locked = { ...ladder, channel: 'b2b' as const, quoteOverride: 77 }
  for (const surface of ['quote', 'order', 'email', 'pdf', 'presentation'] as const) {
    assert.equal(surfaceUnitPrice(locked), 77, surface)
  }
  assert.equal(surfaceUnitPrice({ channel: 'b2c', retailPrice: 100, quoteOverride: 77 }), 77)
})
