import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import {
  deriveClientHoldings,
  filterSamples,
  planOpeningSample,
  planReceiveIntoOffice,
  type SampleCounts,
} from '../src/lib/samples/ledger.ts'

const stock = (withClient: number, inOffice = 1): SampleCounts => ({
  in_office: inOffice,
  with_team: 0,
  with_client: withClient,
  pending_supplier: 0,
})

test('receive into office returns the pieces and squares off the client balance', () => {
  const full = planReceiveIntoOffice({
    productId: 'product-1',
    companyId: 'company-1',
    quantity: '2',
    condition: 'Box scuffed',
    note: 'Returned after the meeting',
    stock: stock(2, 1),
    clientHolding: 2,
  })
  assert.equal(full.ok, true)
  if (!full.ok) return
  assert.equal(full.inOffice, 3)
  assert.equal(full.withClient, 0)
  assert.equal(full.clientHolding, 0)
  assert.equal(full.squaredOff, true)
  assert.deepEqual(full.movement, {
    product_id: 'product-1',
    quantity: 2,
    from_holder: 'client',
    to_holder: 'office',
    company_id: 'company-1',
    holder_profile_id: null,
    condition: 'Box scuffed',
    note: 'Returned after the meeting',
  })

  const partial = planReceiveIntoOffice({
    productId: 'product-1',
    companyId: 'company-1',
    quantity: '1',
    condition: '',
    note: '',
    stock: stock(4, 0),
    clientHolding: 2,
  })
  assert.equal(partial.ok, true)
  if (!partial.ok) return
  assert.equal(partial.inOffice, 1)
  assert.equal(partial.withClient, 3)
  assert.equal(partial.clientHolding, 1)
  assert.equal(partial.squaredOff, false)
  assert.equal(partial.movement.condition, null)
  assert.equal(partial.movement.note, null)
})

test('receive into office rejects a quantity the client does not hold', () => {
  const overClient = planReceiveIntoOffice({
    productId: 'product-1',
    companyId: 'company-1',
    quantity: '3',
    condition: '',
    note: '',
    stock: stock(5),
    clientHolding: 2,
  })
  assert.equal(overClient.ok, false)
  if (overClient.ok) return
  assert.match(overClient.error, /holds 2/)

  const overBucket = planReceiveIntoOffice({
    productId: 'product-1',
    companyId: 'company-1',
    quantity: '2',
    condition: '',
    note: '',
    stock: stock(1),
    clientHolding: 2,
  })
  assert.equal(overBucket.ok, false)
  if (overBucket.ok) return
  assert.match(overBucket.error, /Only 1 are with clients/)

  for (const quantity of ['0', '-1', '1.5', '', 'two']) {
    const result = planReceiveIntoOffice({
      productId: 'product-1',
      companyId: 'company-1',
      quantity,
      condition: '',
      note: '',
      stock: stock(4),
      clientHolding: 4,
    })
    assert.equal(result.ok, false, quantity)
  }

  assert.equal(
    planReceiveIntoOffice({
      productId: ' ',
      companyId: 'company-1',
      quantity: '1',
      condition: '',
      note: '',
      stock: stock(1),
      clientHolding: 1,
    }).ok,
    false,
  )
  assert.equal(
    planReceiveIntoOffice({
      productId: 'product-1',
      companyId: '',
      quantity: '1',
      condition: '',
      note: '',
      stock: stock(1),
      clientHolding: 1,
    }).ok,
    false,
  )
})

test('sample-only products and an initial quantity open an office receipt', () => {
  assert.deepEqual(planOpeningSample({ sampleOnly: true, sampleQtyRaw: '', stockExists: false }), {
    ok: true,
    add: 1,
    ensureRow: true,
  })
  assert.deepEqual(planOpeningSample({ sampleOnly: true, sampleQtyRaw: '4', stockExists: false }), {
    ok: true,
    add: 4,
    ensureRow: true,
  })
  assert.deepEqual(planOpeningSample({ sampleOnly: true, sampleQtyRaw: '', stockExists: true }), {
    ok: true,
    add: 0,
    ensureRow: false,
  })
  assert.deepEqual(planOpeningSample({ sampleOnly: true, sampleQtyRaw: '0', stockExists: false }), {
    ok: true,
    add: 0,
    ensureRow: true,
  })
  assert.deepEqual(planOpeningSample({ sampleOnly: false, sampleQtyRaw: '2', stockExists: false }), {
    ok: true,
    add: 2,
    ensureRow: true,
  })
  assert.deepEqual(planOpeningSample({ sampleOnly: false, sampleQtyRaw: '', stockExists: false }), {
    ok: true,
    add: 0,
    ensureRow: false,
  })
  const invalid = planOpeningSample({ sampleOnly: true, sampleQtyRaw: '1.2', stockExists: false })
  assert.equal(invalid.ok, false)
})

test('sample search matches product name, SKU, and the company holding it', () => {
  const rows = [
    { name: 'Brass Diya', sku: 'DIYA-1', holders: ['Acme Gifts'] },
    { name: 'Notebook', sku: 'NB-9', holders: ['Northwind'] },
  ]
  assert.equal(filterSamples(rows, 'diya').length, 1)
  assert.equal(filterSamples(rows, 'nb-9')[0]?.name, 'Notebook')
  assert.equal(filterSamples(rows, 'acme')[0]?.sku, 'DIYA-1')
  assert.equal(filterSamples(rows, 'missing').length, 0)
  assert.equal(filterSamples(rows, '  ').length, 2)
})

test('client balances derived from movements ignore a fully returned sample', () => {
  const rows = deriveClientHoldings([
    { product_id: 'p', company_id: 'c', company_name: 'Acme', quantity: 3, from_holder: 'office', to_holder: 'client' },
    { product_id: 'p', company_id: 'c', company_name: 'Acme', quantity: 1, from_holder: 'client', to_holder: 'office' },
    { product_id: 'p', company_id: 'd', company_name: 'Done', quantity: 1, from_holder: 'office', to_holder: 'client' },
    { product_id: 'p', company_id: 'd', company_name: 'Done', quantity: 1, from_holder: 'client', to_holder: 'office' },
  ])
  assert.deepEqual(rows, [{ productId: 'p', companyId: 'c', name: 'Acme', quantity: 2 }])
})

test('receive action writes the office and client balances and the migration stays staff-only', () => {
  const actions = readFileSync(new URL('../src/app/crm/samples/actions.ts', import.meta.url), 'utf8')
  assert.match(actions, /export async function receiveIntoOffice/)
  assert.match(actions, /planReceiveIntoOffice/)
  assert.match(actions, /in_office: planned\.inOffice/)
  assert.match(actions, /with_client: planned\.withClient/)
  assert.match(actions, /sample_holdings/)

  const sql = readFileSync(new URL('../supabase/migrations/20261027_sample_internal_ledger.sql', import.meta.url), 'utf8')
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on table public\.sample_stock from public, anon, authenticated/)
  assert.match(sql, /revoke all on table public\.sample_movements from public, anon, authenticated/)
  assert.match(sql, /revoke all on table public\.sample_holdings from public, anon, authenticated/)
  assert.match(sql, /is_sample_reader/)
  assert.match(sql, /is_sample_writer/)
  assert.doesNotMatch(sql, /to anon/)
  assert.doesNotMatch(sql, /for select\s+using \(true\)/)
  assert.doesNotMatch(sql, /is_client\(\)|is_business\(\)/)
  assert.match(sql, /create table if not exists public\.sample_holdings/)
  assert.match(sql, /add column if not exists holder_profile_id/)
  assert.match(sql, /not exists/)

  const root = new URL('..', import.meta.url).pathname
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        walk(path)
        continue
      }
      if (!/\.(ts|tsx)$/.test(name)) continue
      const rel = path.slice(root.length)
      if (rel.startsWith('src/app/crm/') || rel.startsWith('src/lib/samples/')) continue
      const text = readFileSync(path, 'utf8')
      if (/sample_stock|sample_movements|sample_holdings/.test(text)) hits.push(rel)
    }
  }
  walk(join(root, 'src'))
  assert.deepEqual(hits, [])
})
