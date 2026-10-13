import assert from 'node:assert/strict'
import test from 'node:test'
import { expandCatalogRfqLines } from '../src/lib/catalogs/rfq-lines.ts'
import {
  HIDDEN_CATALOG_LINE_ERROR,
  campaignIdsWithVisibleItems,
  hiddenCatalogItemNames,
  kitDisplayTotal,
  productVisibleInScope,
  roundMoney,
  selectionIncludesHiddenLine,
  visibleCatalogLines,
  withVisibleKitTotals,
} from '../src/lib/catalogs/visibility.ts'

const company = { kind: 'company' as const, companyId: 'co' }
const noAccess = { granted: false, excluded: false }

test('guest visibility is active public catalogue products only', () => {
  const guest = { kind: 'public' as const }
  assert.equal(productVisibleInScope({ status: 'active', catalogue_access: 'all' }, guest), true)
  assert.equal(productVisibleInScope({ status: 'active', catalogue_access: 'selected' }, guest, { granted: true, excluded: false }), false)
  assert.equal(productVisibleInScope({ status: 'active', catalogue_access: 'none' }, guest), false)
  assert.equal(productVisibleInScope({ status: 'draft', catalogue_access: 'all' }, guest), false)
})

test('company visibility matches public catalogue, grants, and exclusions', () => {
  assert.equal(productVisibleInScope({ status: 'active', catalogue_access: 'all' }, company, noAccess), true)
  assert.equal(productVisibleInScope({ status: 'active', catalogue_access: 'all' }, company, { granted: false, excluded: true }), false)
  assert.equal(productVisibleInScope({ status: 'active', catalogue_access: 'selected' }, company, { granted: true, excluded: false }), true)
  assert.equal(productVisibleInScope({ status: 'active', catalogue_access: 'selected' }, company, noAccess), false)
  assert.equal(productVisibleInScope({ status: 'active', catalogue_access: 'selected' }, company, { granted: true, excluded: true }), false)
  assert.equal(productVisibleInScope({ status: 'active', catalogue_access: 'none' }, company, { granted: true, excluded: false }), false)
  assert.equal(productVisibleInScope({ status: 'archived', catalogue_access: 'all' }, company, noAccess), false)
})

test('a kit is hidden when any member is hidden, and a visible standalone stays', () => {
  const lines = [
    { id: 'mug-line', product_id: 'mug', pack_kit_id: 'kit-1' },
    { id: 'bag-line', product_id: 'bag', pack_kit_id: 'kit-1' },
    { id: 'pen-line', product_id: 'pen', pack_kit_id: null },
  ]
  const visible = visibleCatalogLines(lines, new Set(['mug', 'pen']))
  assert.deepEqual(visible.map((line) => line.id), ['pen-line'])
})

test('displayed kit total matches the products expandCatalogRfqLines requests', () => {
  const lines = [
    { id: 'mug-line', product_id: 'mug', pack_kit_id: 'kit-1', pack_kit_role: 'primary' as const, moq: 1, selling_price: 10.1, pack_kit_total: 999, product: { name: 'Mug', sku: 'MUG' } },
    { id: 'bag-line', product_id: 'bag', pack_kit_id: 'kit-1', pack_kit_role: 'line' as const, moq: 1, selling_price: 20.2, pack_kit_total: null, product: { name: 'Bag', sku: 'BAG' } },
    { id: 'pen-line', product_id: 'pen', pack_kit_id: null, pack_kit_role: null, moq: 1, selling_price: 5, pack_kit_total: null, product: { name: 'Pen', sku: 'PEN' } },
  ]
  const visible = visibleCatalogLines(lines, new Set(['mug', 'bag', 'pen']))
  const shown = withVisibleKitTotals(visible)
  const primary = shown.find((line) => line.id === 'mug-line')
  assert.equal(primary?.pack_kit_total, roundMoney(10.1 + 20.2))
  assert.equal(kitDisplayTotal(visible.filter((line) => line.pack_kit_id === 'kit-1')), primary?.pack_kit_total)

  const expanded = expandCatalogRfqLines(visible, [{ id: 'mug-line', quantity: 2 }])
  assert.deepEqual(
    expanded.lines?.map((line) => line.product_id).sort(),
    ['bag', 'mug'],
  )
  assert.equal(expanded.lines?.every((line) => line.quantity === 2), true)

  const hiddenMember = visibleCatalogLines(lines, new Set(['mug', 'pen']))
  assert.equal(selectionIncludesHiddenLine(lines, hiddenMember, [{ id: 'mug-line' }]), true)
  assert.equal(
    expandCatalogRfqLines(hiddenMember, [{ id: 'mug-line', quantity: 1 }]).error,
    'One of the selected products is not on this catalog',
  )
  assert.equal(HIDDEN_CATALOG_LINE_ERROR.includes('not available'), true)
})

test('portal catalog list drops catalogs with nothing the company can see', () => {
  const lines = [
    { campaign_id: 'empty', product_id: 'secret', pack_kit_id: null },
    { campaign_id: 'broken-kit', product_id: 'mug', pack_kit_id: 'kit-1' },
    { campaign_id: 'broken-kit', product_id: 'bag', pack_kit_id: 'kit-1' },
    { campaign_id: 'open', product_id: 'pen', pack_kit_id: null },
    { campaign_id: 'open', product_id: 'secret', pack_kit_id: 'kit-2' },
    { campaign_id: 'open', product_id: 'mug', pack_kit_id: 'kit-2' },
  ]
  const keep = campaignIdsWithVisibleItems(lines, new Set(['mug', 'pen']))
  assert.equal(keep.has('empty'), false)
  assert.equal(keep.has('broken-kit'), false)
  assert.equal(keep.has('open'), true)
})

test('assign warning lists items the company cannot see', () => {
  const names = hiddenCatalogItemNames(
    [
      { productId: '1', name: 'Public mug', status: 'active', catalogueAccess: 'all' },
      { productId: '1', name: 'Public mug duplicate', status: 'active', catalogueAccess: 'all' },
      { productId: '2', name: 'Notebook', status: 'active', catalogueAccess: 'selected' },
      { productId: '3', name: 'Secret pen', status: 'active', catalogueAccess: 'selected' },
      { productId: '4', name: 'Excluded tote', status: 'active', catalogueAccess: 'all' },
      { productId: '5', name: 'Internal', status: 'active', catalogueAccess: 'none' },
      { productId: '6', name: 'Archived', status: 'archived', catalogueAccess: 'all' },
    ],
    { grantedIds: new Set(['2']), excludedIds: new Set(['4']) },
  )
  assert.deepEqual(names, ['Secret pen', 'Excluded tote', 'Internal', 'Archived'])
})
