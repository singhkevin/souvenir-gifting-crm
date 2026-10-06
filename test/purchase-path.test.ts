import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeCheckout,
  purchaseCaption,
  purchaseOffer,
} from '../src/lib/catalogue/purchase-path.ts'

const PRODUCT = '11111111-1111-4111-8111-111111111111'

test('rfq flag ignores stock', () => {
  const offer = purchaseOffer({ fulfillmentMode: 'rfq', stockQty: 40, hasSellPrice: true })
  assert.equal(offer.buy, false)
  assert.equal(offer.rfq, true)
  assert.equal(offer.reason, 'flag-rfq')
})

test('auto with zero stock is request quote', () => {
  const offer = purchaseOffer({ fulfillmentMode: 'auto', stockQty: 0 })
  assert.deepEqual(
    { buy: offer.buy, rfq: offer.rfq, reason: offer.reason },
    { buy: false, rfq: true, reason: 'zero-stock' },
  )
  assert.equal(purchaseCaption(offer), 'Request a quote')
})

test('auto with stock is a partial: buy the stock and quote the rest', () => {
  const offer = purchaseOffer({ fulfillmentMode: 'auto', stockQty: 6, hasSellPrice: true })
  assert.equal(offer.buy, true)
  assert.equal(offer.rfq, true)
  assert.equal(offer.maxBuyQty, 6)
  assert.equal(offer.reason, 'stock')
  assert.match(purchaseCaption(offer), /6 in stock/)
})

test('buy flag with zero stock is an uncapped purchase and skips quote', () => {
  const offer = purchaseOffer({ fulfillmentMode: 'buy', stockQty: 0, hasSellPrice: true })
  assert.equal(offer.buy, true)
  assert.equal(offer.rfq, false)
  assert.equal(offer.maxBuyQty, null)
  assert.equal(offer.reason, 'flag-buy')
})

test('buy flag with stock still caps the cart and leaves quote open for the rest', () => {
  const offer = purchaseOffer({ fulfillmentMode: 'buy', stockQty: 2, hasSellPrice: true })
  assert.equal(offer.maxBuyQty, 2)
  assert.equal(offer.rfq, true)
  assert.equal(offer.reason, 'stock')
})

test('a missing sell price forces request quote', () => {
  const offer = purchaseOffer({ fulfillmentMode: 'buy', stockQty: 9, hasSellPrice: false })
  assert.equal(offer.buy, false)
  assert.equal(offer.rfq, true)
  assert.equal(offer.reason, 'no-price')
})

test('catalog kits stay on request quote', () => {
  const offer = purchaseOffer({
    fulfillmentMode: 'buy',
    stockQty: 20,
    hasSellPrice: true,
    catalogKit: true,
  })
  assert.equal(offer.buy, false)
  assert.equal(offer.reason, 'catalog-kit')
})

test('unknown flag and missing stock behave as auto with nothing on hand', () => {
  const offer = purchaseOffer({ fulfillmentMode: 'retail', stockQty: null })
  assert.equal(offer.mode, 'auto')
  assert.equal(offer.reason, 'zero-stock')
})

test('checkout keeps one catalogue and sums duplicate products', () => {
  const mixed = normalizeCheckout([
    { productId: PRODUCT, quantity: 1, catalogId: null },
    { productId: PRODUCT, quantity: 1, catalogId: '22222222-2222-4222-8222-222222222222' },
  ])
  assert.equal('error' in mixed, true)

  const same = normalizeCheckout([
    { productId: PRODUCT, quantity: 2, catalogId: null },
    { productId: PRODUCT, quantity: 3 },
  ])
  assert.equal('lines' in same && same.lines[0].quantity, 5)
})
