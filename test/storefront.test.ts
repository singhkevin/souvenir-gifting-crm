import assert from 'node:assert/strict'
import test from 'node:test'
import {
  occasionTagList,
  shopModeFromCookie,
  storefrontSampleOffer,
  storeSampleQuantityError,
} from '../src/lib/catalogue/storefront.ts'

test('retail store sells in-stock gifts from quantity 1', () => {
  const inStock = storefrontSampleOffer({ fulfillmentMode: 'auto', stockQty: 6, hasSellPrice: true })
  assert.equal(inStock.buy, true)
  assert.equal(inStock.maxBuyQty, 6)

  const empty = storefrontSampleOffer({ fulfillmentMode: 'buy', stockQty: 0, hasSellPrice: true })
  assert.equal(empty.buy, false)
  assert.equal(empty.rfq, false)

  const quoted = storefrontSampleOffer({ fulfillmentMode: 'rfq', stockQty: 4, hasSellPrice: true })
  assert.equal(quoted.buy, false)
  assert.equal(quoted.rfq, true)

  const kit = storefrontSampleOffer({ fulfillmentMode: 'auto', stockQty: 4, catalogKit: true })
  assert.equal(kit.buy, false)

  const sample = storefrontSampleOffer({ fulfillmentMode: 'auto', stockQty: 8, hasSellPrice: true, sampleOnly: true })
  assert.equal(sample.buy, false)
  assert.equal(sample.reason, 'sample')
})

test('store checkout allows a quantity of at least 1', () => {
  assert.equal(storeSampleQuantityError([1, 3]), null)
  assert.match(storeSampleQuantityError([0]) || '', /at least 1/)
})

test('shop mode and occasion tags stay on the known lists', () => {
  assert.equal(shopModeFromCookie('corporate'), 'corporate')
  assert.equal(shopModeFromCookie('retail'), 'retail')
  assert.deepEqual(occasionTagList(['welcome', 'nope', 'welcome']), ['welcome'])
})
