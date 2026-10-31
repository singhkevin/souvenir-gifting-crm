import assert from 'node:assert/strict'
import test from 'node:test'
import { costingFieldsDirty, costingStatusLabel } from '../src/lib/quotes/costing-draft.ts'
import { emptyLiveAhead, reconcileLiveQuote } from '../src/lib/quotes/live-quote.ts'
import { estimateTickedLines, quoteLineTotal } from '../src/lib/quotes/flow.ts'
import { filterPickerProducts, PICKER_DENSE_PAGE_SIZE, PICKER_PAGE_SIZE, slicePickerPage, stockBadge } from '../src/lib/products/picker.ts'

test('a sell-price edit is unsaved until it matches the last save', () => {
  const saved = { offerId: '', cost: '650', margin: '50', unit: '975' }
  assert.equal(costingFieldsDirty({ ...saved, unit: '1000' }, saved), true)
  assert.equal(costingFieldsDirty({ ...saved, unit: '975.000' }, saved), false)
  assert.equal(costingFieldsDirty({ ...saved, cost: '' }, saved), true)
  assert.equal(costingStatusLabel(true, true), 'Saving…')
  assert.equal(costingStatusLabel(false, true), 'Unsaved changes')
  assert.equal(costingStatusLabel(false, false), 'Saved')
})

test('a saved sell price updates the draft totals before the server echoes it', () => {
  const before = estimateTickedLines(
    [{ quantity: 1, unitPrice: 975, lineTotal: quoteLineTotal(1, 975, 0) }],
    18,
  )
  assert.equal(before.subtotal, 975)
  assert.equal(before.total, 1150.5)

  const saved = estimateTickedLines(
    [{ quantity: 1, unitPrice: 1000, lineTotal: quoteLineTotal(1, 1000, 0) }],
    18,
  )
  assert.equal(saved.subtotal, 1000)
  assert.equal(saved.tax, 180)
  assert.equal(saved.total, 1180)
})

test('an optimistic price survives a stale refresh and clears once the server catches up', () => {
  const server = {
    lines: [{ id: 'line-1', quantity: 1, unitPrice: 975 }],
    discountPercent: 0,
    taxPercent: 18,
  }
  const ahead = emptyLiveAhead()
  ahead.prices['line-1'] = 1000
  const pending = reconcileLiveQuote(server, ahead)
  assert.equal(pending.lines[0]?.unitPrice, 1000)
  assert.equal(pending.ahead.prices['line-1'], 1000)

  const caughtUp = reconcileLiveQuote(
    { ...server, lines: [{ id: 'line-1', quantity: 1, unitPrice: 1000 }] },
    pending.ahead,
  )
  assert.equal(caughtUp.lines[0]?.unitPrice, 1000)
  assert.equal(caughtUp.ahead.prices['line-1'], undefined)
})

test('product grid filters by search and category, then pages the rest', () => {
  const products = [
    { id: '1', name: 'Brass Diya', sku: 'DIA-1', category: 'Decor', price: 400 },
    { id: '2', name: 'Cotton Tote', sku: 'TOTE-2', category: 'Bags', price: 250 },
    { id: '3', name: 'Brass Lamp', sku: 'LAMP-3', category: 'Decor', price: 1800 },
  ]
  const decor = filterPickerProducts(products, { query: 'brass', category: 'Decor', minPrice: '', maxPrice: '' })
  assert.deepEqual(decor.map((product) => product.id), ['1', '3'])
  const priced = filterPickerProducts(products, { query: '', category: '', minPrice: '300', maxPrice: '500' })
  assert.deepEqual(priced.map((product) => product.id), ['1'])
  const page = slicePickerPage(products, 2)
  assert.equal(page.items.length, 2)
  assert.equal(page.remaining, 1)
  assert.deepEqual(stockBadge(0), { label: 'Out of stock', tone: 'out' })
  assert.deepEqual(stockBadge(3), { label: '3 in stock', tone: 'low' })
  assert.deepEqual(stockBadge(12), { label: '12 in stock', tone: 'in' })
  assert.equal(stockBadge(null), null)
  assert.equal(PICKER_PAGE_SIZE, 24)
  assert.ok(PICKER_DENSE_PAGE_SIZE >= 60)
  const dense = slicePickerPage(Array.from({ length: 80 }, (_, index) => index), PICKER_DENSE_PAGE_SIZE)
  assert.equal(dense.items.length, PICKER_DENSE_PAGE_SIZE)
  assert.equal(dense.remaining, 80 - PICKER_DENSE_PAGE_SIZE)
})
