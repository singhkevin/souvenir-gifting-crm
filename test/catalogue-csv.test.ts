import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { CSV_FIELD_ALIASES, autoMapHeaders } from '../src/lib/csv.ts'
import {
  ignoredCostWarning,
  parseOptionalNumber,
  parseProductStatus,
  sideEffectWarning,
} from '../src/lib/products/csv-import.ts'

test('quantity maps to stock and MOQ keeps order-quantity aliases only', () => {
  assert.equal(CSV_FIELD_ALIASES.moq.includes('quantity'), false)
  assert.deepEqual(
    CSV_FIELD_ALIASES.moq.filter((alias) => ['moq', 'min_order', 'minimum_order_quantity'].includes(alias)).sort(),
    ['min_order', 'minimum_order_quantity', 'moq'],
  )
  assert.equal(CSV_FIELD_ALIASES.stock_qty.includes('quantity'), true)
  assert.equal(CSV_FIELD_ALIASES.stock_qty.includes('stock'), true)

  const quantityOnly = autoMapHeaders(['Quantity', 'Name', 'SKU', 'Price'])
  assert.equal(quantityOnly.stock_qty, 'Quantity')
  assert.equal(quantityOnly.moq, undefined)

  const both = autoMapHeaders(['Minimum Order Quantity', 'Stock', 'Min Order'])
  assert.equal(both.moq, 'Minimum Order Quantity')
  assert.equal(both.stock_qty, 'Stock')

  const minOrder = autoMapHeaders(['Min Order'])
  assert.equal(minOrder.moq, 'Min Order')
})

test('cost, variant, and status columns are import fields', () => {
  const source = fs.readFileSync('src/app/crm/products/CatalogueCsvImporter.tsx', 'utf8')
  for (const key of ['internal_margin', 'internal_notes', 'variant_sku', 'extra_price', 'supplier_cost']) {
    assert.equal(source.includes(`key: '${key}'`), true, key)
  }
  assert.equal(autoMapHeaders(['Product margin', 'Internal notes', 'Variant SKU', 'Extra price']).internal_margin, 'Product margin')
  assert.equal(autoMapHeaders(['Internal notes']).internal_notes, 'Internal notes')
  assert.equal(autoMapHeaders(['Variant SKU']).variant_sku, 'Variant SKU')
  assert.equal(autoMapHeaders(['Extra price']).extra_price, 'Extra price')
  assert.equal(autoMapHeaders(['Notes']).description, 'Notes')
  assert.equal(autoMapHeaders(['Notes']).internal_notes, undefined)
})

test('invalid status is rejected and a blank status stays active', () => {
  assert.deepEqual(parseProductStatus(''), { ok: true, status: 'active' })
  assert.deepEqual(parseProductStatus(' Inactive '), { ok: true, status: 'inactive' })
  assert.deepEqual(parseProductStatus('discontinued'), { ok: true, status: 'discontinued' })
  const invalid = parseProductStatus('archived')
  assert.equal(invalid.ok, false)
  if (!invalid.ok) assert.match(invalid.reason, /active, inactive, or discontinued/)
})

test('accounts without cost access ignore cost cells and keep one warning', () => {
  const action = fs.readFileSync('src/app/crm/products/import-actions.ts', 'utf8')
  assert.equal(action.includes('canSeeCosts(profile.role)'), true)
  assert.equal(action.includes('ignoredCostWarning(mappedRows)'), true)
  assert.equal(action.includes('upsertProductCost'), true)

  const warning = ignoredCostWarning([
    { name: 'Pen', supplier_cost: '', internal_margin: '', internal_notes: '' },
    { name: 'Mug', supplier_cost: '40', internal_margin: '12', internal_notes: 'landed' },
  ])
  assert.equal(warning?.row, 0)
  assert.match(warning?.reason || '', /cannot import supplier cost/)

  assert.equal(ignoredCostWarning([{ name: 'Pen', supplier_cost: '  ' }]), null)
  assert.deepEqual(parseOptionalNumber(''), { ok: true, value: null })
  assert.deepEqual(parseOptionalNumber('12.5'), { ok: true, value: 12.5 })
  assert.deepEqual(parseOptionalNumber('0'), { ok: true, value: 0 })
  assert.deepEqual(parseOptionalNumber('nope'), { ok: false })
})

test('image and variant save errors are warnings and a clean save is not', () => {
  const action = fs.readFileSync('src/app/crm/products/import-actions.ts', 'utf8')
  assert.equal(action.includes("sideEffectWarning(item.rowNumber, item.sku, 'image'"), true)
  assert.equal(action.includes("sideEffectWarning(item.rowNumber, item.sku, 'variant'"), true)
  assert.equal(sideEffectWarning(2, 'PEN-1', 'image', null), null)
  assert.equal(sideEffectWarning(2, 'PEN-1', 'variant', '   '), null)
  assert.deepEqual(sideEffectWarning(4, 'MUG-2', 'image', 'bucket missing'), {
    row: 4,
    sku: 'MUG-2',
    reason: 'Image was not saved: bucket missing',
  })
  assert.deepEqual(sideEffectWarning(5, 'MUG-2', 'variant', 'null value in column "colour"'), {
    row: 5,
    sku: 'MUG-2',
    reason: 'Variant was not saved: null value in column "colour"',
  })
})
