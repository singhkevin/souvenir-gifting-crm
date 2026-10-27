import assert from 'node:assert/strict'
import test from 'node:test'
import {
  planInitialSampleStock,
  planReceiveIntoOffice,
  planSampleTransfer,
  type SampleCounts,
} from '../src/lib/samples/ledger.ts'

const stock = (overrides: Partial<SampleCounts> = {}): SampleCounts => ({
  inOffice: 2,
  withTeam: 1,
  withClient: 3,
  pendingSupplier: 0,
  ...overrides,
})

test('receive into office squares off the client and returns the pieces', () => {
  const plan = planReceiveIntoOffice({ quantity: 1, clientHeld: 1, stock: stock({ withClient: 1, inOffice: 4 }) })
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  assert.equal(plan.stock.inOffice, 5)
  assert.equal(plan.stock.withClient, 0)
  assert.equal(plan.companyHeld, 0)
  assert.equal(plan.stock.withTeam, 1)
})

test('receive into office rejects more than that client holds', () => {
  const plan = planReceiveIntoOffice({ quantity: 2, clientHeld: 1, stock: stock({ withClient: 5 }) })
  assert.equal(plan.ok, false)
  if (plan.ok) return
  assert.match(plan.error, /holds 1/)
})

test('receive into office rejects more than the client total', () => {
  const plan = planReceiveIntoOffice({ quantity: 2, clientHeld: 4, stock: stock({ withClient: 1 }) })
  assert.equal(plan.ok, false)
  if (plan.ok) return
  assert.match(plan.error, /Only 1/)
})

test('receive into office rejects a client who holds nothing', () => {
  const plan = planReceiveIntoOffice({ quantity: 1, clientHeld: 0, stock: stock() })
  assert.equal(plan.ok, false)
  if (plan.ok) return
  assert.match(plan.error, /does not hold/)
})

test('receive into office rejects a blank or partial quantity', () => {
  for (const quantity of [0, -1, 1.5]) {
    const plan = planReceiveIntoOffice({ quantity, clientHeld: 2, stock: stock() })
    assert.equal(plan.ok, false)
  }
})

test('a partial return leaves the rest with the client', () => {
  const plan = planReceiveIntoOffice({ quantity: 2, clientHeld: 5, stock: stock({ withClient: 5, inOffice: 0 }) })
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  assert.equal(plan.companyHeld, 3)
  assert.equal(plan.stock.withClient, 3)
  assert.equal(plan.stock.inOffice, 2)
})

test('send to a team member records the move out of the office', () => {
  const plan = planSampleTransfer({
    from: 'office',
    to: 'team',
    quantity: 1,
    stock: stock({ inOffice: 2, withTeam: 0 }),
    companyHeld: null,
    teamHeld: 0,
  })
  assert.equal(plan.ok, true)
  if (!plan.ok) return
  assert.equal(plan.stock.inOffice, 1)
  assert.equal(plan.stock.withTeam, 1)
  assert.equal(plan.teamHeld, 1)
})

test('ticking sample only with stock creates an office receipt', () => {
  const plan = planInitialSampleStock({
    sampleOnly: true,
    initialQty: null,
    stockQty: 4,
    existingInOffice: null,
  })
  assert.deepEqual(plan, { action: 'ensure', addQty: 4 })
})

test('ticking sample only with no pieces still creates the register row', () => {
  const plan = planInitialSampleStock({
    sampleOnly: true,
    initialQty: null,
    stockQty: 0,
    existingInOffice: null,
  })
  assert.deepEqual(plan, { action: 'ensure', addQty: 0 })
})

test('an initial sample quantity is the receipt even when sample only is off', () => {
  const plan = planInitialSampleStock({
    sampleOnly: false,
    initialQty: 2,
    stockQty: 10,
    existingInOffice: null,
  })
  assert.deepEqual(plan, { action: 'ensure', addQty: 2 })
})

test('a later save does not add the same pieces again', () => {
  const plan = planInitialSampleStock({
    sampleOnly: true,
    initialQty: null,
    stockQty: 4,
    existingInOffice: 4,
  })
  assert.deepEqual(plan, { action: 'skip' })
})

test('typing a quantity on an existing sample adds that many', () => {
  const plan = planInitialSampleStock({
    sampleOnly: true,
    initialQty: 3,
    stockQty: 4,
    existingInOffice: 4,
  })
  assert.deepEqual(plan, { action: 'ensure', addQty: 3 })
})

test('a normal product with no sample quantity is not added to samples', () => {
  const plan = planInitialSampleStock({
    sampleOnly: false,
    initialQty: null,
    stockQty: 8,
    existingInOffice: null,
  })
  assert.deepEqual(plan, { action: 'skip' })
})
