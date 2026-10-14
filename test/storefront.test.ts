import assert from 'node:assert/strict'
import test from 'node:test'
import {
  occasionTagList,
  shopModeFromCookie,
  storefrontSampleOffer,
  storeSampleQuantityError,
} from '../src/lib/catalogue/storefront.ts'

test('a store sample is one unit from stock', () => {
  const inStock = storefrontSampleOffer({ fulfillmentMode: 'auto', stockQty: 6, hasSellPrice: true })
  assert.equal(inStock.buy, true)
  assert.equal(inStock.rfq, true)
  assert.equal(inStock.maxBuyQty, 1)

  const empty = storefrontSampleOffer({ fulfillmentMode: 'buy', stockQty: 0, hasSellPrice: true })
  assert.equal(empty.buy, false)
  assert.equal(empty.rfq, true)

  const kit = storefrontSampleOffer({ fulfillmentMode: 'auto', stockQty: 4, catalogKit: true })
  assert.equal(kit.buy, false)
})

test('store checkout rejects more than one sample', () => {
  assert.equal(storeSampleQuantityError([1, 1]), null)
  assert.match(storeSampleQuantityError([2]) || '', /one sample/)
})

test('shop mode and occasion tags stay on the known lists', () => {
  assert.equal(shopModeFromCookie('corporate'), 'corporate')
  assert.equal(shopModeFromCookie('retail'), 'retail')
  assert.deepEqual(occasionTagList(['welcome', 'nope', 'welcome']), ['welcome'])
})
