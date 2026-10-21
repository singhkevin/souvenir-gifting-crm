import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPublicQuoteRecord,
  parseQuoteItems,
  parseQuoteQuantity,
  quoteProductIds,
  resolvePublicQuoteLines,
} from '../src/lib/catalogue/public-quote.ts'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const products = [
  { id: A, name: 'Kraft Notebook A5', sku: 'NB-A5' },
  { id: B, name: 'Steel Bottle', sku: 'BT-750' },
]

test('parseQuoteQuantity takes the first whole number and clamps it', () => {
  assert.equal(parseQuoteQuantity('50'), 50)
  assert.equal(parseQuoteQuantity('approx 1,200 units'), 1200)
  assert.equal(parseQuoteQuantity('50-100'), 50)
  assert.equal(parseQuoteQuantity(''), null)
  assert.equal(parseQuoteQuantity('0'), null)
  assert.equal(parseQuoteQuantity('9999999'), 100000)
})

test('single product request maps to a requirement line with product id, SKU and quantity', () => {
  const lines = resolvePublicQuoteLines({ items: [], productId: A, productName: 'Kraft Notebook A5', quantity: '75', products })
  assert.deepEqual(lines, [{ productId: A, name: 'Kraft Notebook A5', sku: 'NB-A5', quantity: 75 }])
  const record = buildPublicQuoteRecord({ companyName: 'Acme', contactName: 'Sid', lines, quantity: '75', message: 'Diwali' })
  assert.equal(record.leadNotes, 'Website catalogue enquiry\nProduct: Kraft Notebook A5 (NB-A5)\nQuantity: 75\nDiwali')
  assert.equal(record.requirementName, 'Website RFQ: Kraft Notebook A5')
  assert.equal(record.requirementQuantity, 75)
  assert.deepEqual(record.requirementProducts, [{ product_id: A, quantity: 75 }])
  assert.equal(record.productSummary, 'Kraft Notebook A5')
  assert.equal(record.notificationBody, 'Acme asked for a quote: Kraft Notebook A5 x 75.')
  assert.match(record.requirementDescription, /Contact: Sid/)
  assert.match(record.requirementDescription, /Message:\nDiwali/)
})

test('blank quantity defaults the line to 1', () => {
  const lines = resolvePublicQuoteLines({ items: [], productId: A, quantity: '', products })
  assert.equal(lines[0].quantity, 1)
})

test('cart request keeps every product, merges repeats and sums the quantity', () => {
  const items = parseQuoteItems(JSON.stringify([
    { id: A, name: 'Kraft Notebook A5', quantity: 10 },
    { id: B, name: 'Steel Bottle', quantity: 5 },
    { id: A, name: 'Kraft Notebook A5', quantity: 2 },
    { bogus: true },
  ]))
  assert.equal(items.length, 3)
  assert.deepEqual(quoteProductIds({ items }), [A, B])
  const lines = resolvePublicQuoteLines({ items, products })
  const record = buildPublicQuoteRecord({ companyName: 'Acme', lines })
  assert.deepEqual(record.requirementProducts, [
    { product_id: A, quantity: 12 },
    { product_id: B, quantity: 5 },
  ])
  assert.equal(record.requirementQuantity, 17)
  assert.equal(record.requirementName, 'Website RFQ: Kraft Notebook A5 +1 more')
  assert.match(record.leadNotes, /Products:\n {2}- Kraft Notebook A5 \(NB-A5\) x 12\n {2}- Steel Bottle \(BT-750\) x 5/)
  assert.doesNotMatch(record.leadNotes, /Quantity:/)
})

test('unknown or hidden product keeps its name but has no requirement line', () => {
  const lines = resolvePublicQuoteLines({ items: [], productId: 'not-a-uuid', productName: 'Mystery Hamper', quantity: '20', products })
  const record = buildPublicQuoteRecord({ companyName: 'Acme', lines, quantity: '20' })
  assert.deepEqual(record.requirementProducts, [])
  assert.equal(record.productSummary, 'Mystery Hamper')
  assert.match(record.leadNotes, /Product: Mystery Hamper/)
  assert.match(record.requirementDescription, /Not matched to a catalogue product: Mystery Hamper/)
})

test('generic enquiry still produces a requirement with notes', () => {
  const lines = resolvePublicQuoteLines({ items: [], quantity: '1', products: [] })
  assert.deepEqual(lines, [])
  const record = buildPublicQuoteRecord({ companyName: 'viral inbound', lines, quantity: '1', message: 'hghg' })
  assert.equal(record.leadNotes, 'Website catalogue enquiry\nQuantity: 1\nhghg')
  assert.equal(record.requirementName, 'Website enquiry: viral inbound')
  assert.equal(record.requirementQuantity, 1)
  assert.equal(record.productSummary, null)
  assert.equal(record.notificationBody, 'viral inbound asked for a quote.')
  assert.match(record.requirementDescription, /No product selected/)
})
