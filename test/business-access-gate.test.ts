import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20261030_business_access_gate.sql', import.meta.url),
  'utf8',
)
const rollback = readFileSync(
  new URL('../supabase/rollbacks/20261030_business_access_gate_rollback.sql', import.meta.url),
  'utf8',
)

test('business_access gates prices and quote RPCs on a verified account', () => {
  assert.match(migration, /create or replace function public\.business_access\(\)/)
  assert.match(migration, /return 'pending'/)
  assert.match(migration, /return 'verified'/)
  assert.match(migration, /return 'rejected'/)
  assert.match(migration, /return 'blocked'/)
  assert.match(migration, /v_type is distinct from 'business'/)
  assert.match(migration, /public\.business_access\(\) = 'verified'/)
  assert.match(migration, /Only an approved business account can submit this request/)
  assert.match(migration, /Only an approved business account can respond to this quotation/)
  assert.match(migration, /Your account is pending approval/)
  assert.doesNotMatch(migration, /place_direct_order/)
  assert.match(rollback, /drop function if exists public\.business_access\(\)/)
  assert.match(rollback, /and p\.role = 'business_user'\s+and \(p_company_id is null or p\.company_id = p_company_id\)/)
})
