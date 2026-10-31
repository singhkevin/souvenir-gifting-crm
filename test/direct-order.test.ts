import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { DIRECT_ORDER_ROLES, parseDirectOrderPrices } from '../src/lib/orders/direct-order.ts'

const pen = { productId: 'p1', name: 'Pen', quantity: 2 }
const mug = { productId: 'p2', name: 'Mug', quantity: 1 }

test('direct order prices are confirmed ex-GST and GST is added once', () => {
  const parsed = parseDirectOrderPrices([pen, mug], { p1: '100', p2: 50.005 })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.deepEqual(parsed.lines.map((line) => line.lineTotal), [200, 50.01])
  assert.equal(parsed.totals.subtotal, 250.01)
  assert.equal(parsed.totals.tax, 45)
  assert.equal(parsed.totals.total, 295.01)
  assert.equal(parsed.totals.total, parsed.totals.subtotal + parsed.totals.tax)
})

test('direct order rejects an empty brief and a missing or zero sell price', () => {
  assert.equal(parseDirectOrderPrices([], {}).ok, false)
  const missing = parseDirectOrderPrices([pen], {})
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.match(missing.error, /Pen/)
  const zero = parseDirectOrderPrices([pen], { p1: '0' })
  assert.equal(zero.ok, false)
  const negative = parseDirectOrderPrices([mug], { p2: -5 })
  assert.equal(negative.ok, false)
  const badQty = parseDirectOrderPrices([{ ...pen, quantity: 0 }], { p1: 10 })
  assert.equal(badQty.ok, false)
})

test('direct order migration is staff-only and does not wrap its own transaction', () => {
  const sql = fs.readFileSync('supabase/migrations/20261031_order_without_quotation.sql', 'utf8')
  const rollback = fs.readFileSync('supabase/rollbacks/20261031_order_without_quotation_rollback.sql', 'utf8')
  const order = fs.readFileSync('supabase/migrations/APPLY_ORDER.md', 'utf8')
  assert.equal(sql.split('\n').some((line) => line.trim() === 'begin;' || line.trim() === 'commit;'), false)
  assert.equal(rollback.split('\n').some((line) => line.trim() === 'begin;' || line.trim() === 'commit;'), false)
  assert.match(sql, /without_quotation boolean not null default false/)
  assert.match(sql, /without_quotation = false or quotation_id is null/)
  assert.match(sql, /has_any_role\(array\['admin', 'sales', 'management'\]/)
  assert.match(sql, /revoke execute on function public.create_order_from_requirement\(uuid, jsonb\) from public, anon/)
  assert.match(sql, /grant execute on function public.create_order_from_requirement\(uuid, jsonb\) to authenticated/)
  assert.match(sql, /source, without_quotation/)
  assert.match(rollback, /drop function if exists public.create_order_from_requirement/)
  assert.match(order, /20261031_order_without_quotation\.sql/)
  assert.deepEqual(DIRECT_ORDER_ROLES, ['admin', 'sales', 'management'])
})
