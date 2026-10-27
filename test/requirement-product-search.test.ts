import assert from 'node:assert/strict'
import test from 'node:test'
import {
  POSTGREST_MAX_ROWS,
  REQUIREMENT_PICKER_LIMIT,
  capPickerRows,
  firstPostgrestPage,
  pickerStatus,
  productMatchesSearch,
  requirementProductQueryPlan,
} from '../src/lib/requirements/product-search.ts'

test('an unlimited product select hides rows past the PostgREST page', () => {
  const rows = Array.from({ length: POSTGREST_MAX_ROWS + 1 }, (_, index) => ({
    name: `Item ${String(index).padStart(4, '0')}`,
    sku: `SKU-${index}`,
  }))
  rows[rows.length - 1] = { name: 'Zeta North Steel Bottle', sku: 'NSB-170' }
  const ordered = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'en'))
  const seen = firstPostgrestPage(ordered)
  const hidden = ordered.find((row) => row.sku === 'NSB-170')

  assert.ok(hidden)
  assert.equal(seen.length, POSTGREST_MAX_ROWS)
  assert.equal(seen.some((row) => row.sku === 'NSB-170'), false)
  assert.equal(productMatchesSearch(hidden, 'north steel'), true)
  assert.equal(productMatchesSearch(hidden, 'NSB-170'), true)
  assert.equal(productMatchesSearch(hidden, 'Bottle (Steel), north'), true)

  const plan = requirementProductQueryPlan('north steel')
  assert.ok(plan.limit < POSTGREST_MAX_ROWS)
  assert.equal(plan.limit, REQUIREMENT_PICKER_LIMIT)
  assert.equal(plan.fetch, REQUIREMENT_PICKER_LIMIT + 1)
  assert.deepEqual(plan.clauses, [
    'name.ilike.%north%,sku.ilike.%north%',
    'name.ilike.%steel%,sku.ilike.%steel%',
  ])
})

test('search clauses keep a single comma so the or() filter cannot split', () => {
  const plan = requirementProductQueryPlan('Bottle (Steel), 500ml*')
  assert.ok(plan.clauses)
  for (const clause of plan.clauses) {
    assert.equal(clause.split(',').length, 2)
    assert.equal(clause.includes('('), false)
    assert.equal(clause.includes('*'), false)
  }
  assert.equal(requirementProductQueryPlan('   ').clauses, null)
})

test('the picker never mounts more than one small page of products', () => {
  const capped = capPickerRows(Array.from({ length: REQUIREMENT_PICKER_LIMIT + 5 }, (_, index) => index))
  assert.equal(capped.rows.length, REQUIREMENT_PICKER_LIMIT)
  assert.equal(capped.truncated, true)
  assert.equal(capPickerRows([1, 2]).truncated, false)

  const status = pickerStatus({
    searching: false,
    query: '',
    count: REQUIREMENT_PICKER_LIMIT,
    truncated: true,
  })
  assert.match(status, /·/)
  assert.equal(status.includes('//'), false)
})
