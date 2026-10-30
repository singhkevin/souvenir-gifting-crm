import assert from 'node:assert/strict'
import test from 'node:test'
import {
  retailAvailability,
  retailCartOffer,
  splitRetailCart,
  visibleOnRetailStore,
} from '../src/lib/catalogue/availability.ts'
import { prepareRetailCheckout } from '../src/lib/catalogue/checkout-split.ts'
import { planStoreCartAdd } from '../src/lib/catalogue/cart-add.ts'
import {
  planStockAlertSends,
  settleStockAlertJob,
  stockAlertEmail,
  type PendingStockAlert,
} from '../src/lib/catalogue/stock-alert-plan.ts'

const TOTE = '11111111-1111-4111-8111-111111111111'
const DIARY = '22222222-2222-4222-8222-222222222222'

test('in-hand stock is sellable and a sample is not offered', () => {
  const inHand = retailAvailability({ fulfillmentMode: 'auto', stockQty: 6, hasSellPrice: true })
  assert.equal(inHand.offered, true)
  assert.equal(inHand.inHand, 6)
  assert.equal(inHand.reason, 'stock')

  const sample = retailAvailability({ fulfillmentMode: 'buy', stockQty: 8, hasSellPrice: true, sampleOnly: true })
  assert.equal(sample.offered, false)
  assert.equal(sample.inHand, 0)
  assert.equal(sample.reason, 'sample')
  assert.equal(visibleOnRetailStore([{ id: 'a', sample_only: true }, { id: 'b', sample_only: false }]).length, 1)
})

test('retail add-to-cart is not capped at one sample, including zero stock', () => {
  const offer = retailCartOffer({ fulfillmentMode: 'auto', stockQty: 6, hasSellPrice: true })
  assert.equal(offer.buy, true)
  assert.equal(offer.rfq, false)
  assert.equal(offer.maxBuyQty, null)
  assert.equal(offer.stockQty, 6)

  const empty = retailCartOffer({ fulfillmentMode: 'buy', stockQty: 0, hasSellPrice: true })
  assert.equal(empty.buy, true)
  assert.equal(empty.rfq, false)
  assert.equal(empty.stockQty, 0)
  assert.equal(empty.reason, 'zero-stock')

  const quoteOnly = retailCartOffer({ fulfillmentMode: 'rfq', stockQty: 12, hasSellPrice: true })
  assert.equal(quoteOnly.stockQty, 0)
  assert.equal(quoteOnly.reason, 'flag-rfq')
})

test('cart split keeps in-hand units and separates the rest', () => {
  const split = splitRetailCart([
    { id: TOTE, quantity: 8, stockQty: 5 },
    { id: DIARY, quantity: 2, stockQty: 0 },
    { id: '33333333-3333-4333-8333-333333333333', quantity: 1, sampleOnly: true, stockQty: 4 },
  ])
  assert.deepEqual(split.inStock.map((line) => ({ id: line.id, quantity: line.quantity, kind: line.kind })), [
    { id: TOTE, quantity: 5, kind: 'in_stock' },
  ])
  assert.deepEqual(split.backorder.map((line) => ({ id: line.id, quantity: line.quantity, kind: line.kind })), [
    { id: TOTE, quantity: 3, kind: 'backorder' },
    { id: DIARY, quantity: 2, kind: 'backorder' },
  ])
  assert.equal(split.hidden.length, 1)
})

test('a legacy cart line with no stock snapshot stays on the paid checkout', () => {
  const split = splitRetailCart([{ id: TOTE, quantity: 1 }], { unknownIsInStock: true })
  assert.equal(split.inStock.length, 1)
  assert.equal(split.backorder.length, 0)
})

test('checkout preparation sends only the in-hand quantity to the existing order', () => {
  const prepared = prepareRetailCheckout(
    [
      { productId: TOTE, quantity: 4 },
      { productId: DIARY, quantity: 2 },
    ],
    [
      {
        id: TOTE,
        name: 'Demo cotton tote bag',
        sku: 'TOTE',
        stockQty: 1,
        fulfillmentMode: 'auto',
        sampleOnly: false,
        hasSellPrice: true,
        onStore: true,
        active: true,
      },
      {
        id: DIARY,
        name: 'Desk diary',
        sku: 'DRY',
        stockQty: 0,
        fulfillmentMode: 'auto',
        sampleOnly: false,
        hasSellPrice: true,
        onStore: true,
        active: true,
      },
    ],
  )
  assert.ok(!('error' in prepared))
  if ('error' in prepared) return
  assert.deepEqual(prepared.inStock, [{ productId: TOTE, quantity: 1 }])
  assert.equal(prepared.backorder.length, 2)
  assert.equal(prepared.backorder[0].quantity, 3)
  assert.equal(prepared.backorder[1].quantity, 2)
})

test('checkout refuses a sample and a product that is not on the store', () => {
  const sample = prepareRetailCheckout(
    [{ productId: TOTE, quantity: 1 }],
    [{
      id: TOTE,
      name: 'Sample tote',
      sku: 'S',
      stockQty: 3,
      fulfillmentMode: 'auto',
      sampleOnly: true,
      hasSellPrice: true,
      onStore: true,
      active: true,
    }],
  )
  assert.equal('error' in sample && sample.error, 'Samples are not sold on the store.')

  const hidden = prepareRetailCheckout(
    [{ productId: TOTE, quantity: 1 }],
    [{
      id: TOTE,
      name: 'Hidden',
      sku: 'H',
      stockQty: 3,
      fulfillmentMode: 'auto',
      sampleOnly: false,
      hasSellPrice: true,
      onStore: false,
      active: true,
    }],
  )
  assert.match('error' in hidden ? hidden.error : '', /no longer available/)
})

test('store cart add accepts an out-of-stock product and skips a sample', () => {
  const ready = retailCartOffer({ fulfillmentMode: 'auto', stockQty: 2, hasSellPrice: true })
  const empty = retailCartOffer({ fulfillmentMode: 'auto', stockQty: 0, hasSellPrice: true })
  const sample = retailCartOffer({ fulfillmentMode: 'auto', stockQty: 4, hasSellPrice: true, sampleOnly: true })
  const plan = planStoreCartAdd(
    [
      { id: TOTE, quantity: 3 },
      { id: DIARY, quantity: 2 },
      { id: '33333333-3333-4333-8333-333333333333', quantity: 1 },
    ],
    [
      { id: TOTE, purchase: ready },
      { id: DIARY, purchase: empty },
      { id: '33333333-3333-4333-8333-333333333333', purchase: sample },
    ],
  )
  assert.deepEqual(plan.added, [
    { id: TOTE, quantity: 3 },
    { id: DIARY, quantity: 2 },
  ])
  assert.match(plan.skipped.join(' '), /Samples are not sold/)
})

function alert(partial: Partial<PendingStockAlert> & Pick<PendingStockAlert, 'id' | 'email' | 'status'>): PendingStockAlert {
  return {
    productName: 'Demo cotton tote bag',
    productUrl: 'https://www.giftingstore.online/catalogue/11111111-1111-4111-8111-111111111111',
    ...partial,
  }
}

test('a stock increase fires each pending address once, with a product link', () => {
  const alerts = [
    alert({ id: 'a', email: 'a@shop.test', status: 'pending' }),
    alert({ id: 'dup', email: 'A@shop.test', status: 'pending' }),
    alert({ id: 'sent', email: 'done@shop.test', status: 'sent' }),
    alert({ id: 'b', email: 'b@shop.test', status: 'pending' }),
  ]
  const planned = planStockAlertSends({ previousQty: 0, nextQty: 4, alerts })
  assert.deepEqual(planned.map((row) => row.id), ['a', 'b'])
  assert.deepEqual(planStockAlertSends({ previousQty: 4, nextQty: 4, alerts }), [])
  assert.deepEqual(planStockAlertSends({ previousQty: 4, nextQty: 1, alerts }), [])
  assert.deepEqual(planStockAlertSends({ previousQty: 0, nextQty: 0, alerts }), [])

  const email = stockAlertEmail({ productName: alerts[0].productName, productUrl: alerts[0].productUrl })
  assert.match(email.subject, /back in stock/)
  assert.equal(email.html.match(/catalogue\/11111111/g)?.length, 1)
})

test('alert firing marks successes sent and keeps a failed send pending', async () => {
  const alerts = [
    alert({ id: 'a', email: 'a@shop.test', status: 'pending' }),
    alert({ id: 'b', email: 'b@shop.test', status: 'pending' }),
  ]
  const sent: string[] = []
  const ok = await settleStockAlertJob({
    previousQty: 0,
    nextQty: 2,
    alerts,
    send: async (message) => {
      sent.push(message.to)
      assert.match(message.html, /catalogue\/11111111/)
      return {}
    },
  })
  assert.deepEqual(sent, ['a@shop.test', 'b@shop.test'])
  assert.deepEqual(ok.sentIds, ['a', 'b'])
  assert.equal(ok.jobStatus, 'done')

  const failed = await settleStockAlertJob({
    previousQty: 0,
    nextQty: 2,
    alerts,
    send: async (message) => (message.to.startsWith('b') ? { error: 'down' } : {}),
  })
  assert.deepEqual(failed.sentIds, ['a'])
  assert.deepEqual(failed.failedIds, ['b'])
  assert.equal(failed.jobStatus, 'pending')

  const quiet = await settleStockAlertJob({
    previousQty: 3,
    nextQty: 3,
    alerts,
    send: async () => {
      throw new Error('should not send')
    },
  })
  assert.deepEqual(quiet.sentIds, [])
  assert.equal(quiet.jobStatus, 'done')
})
