import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CLIENT_STATUS_LABELS,
  LEGACY_ORDER_STATUS_MAP,
  ORDER_LIFECYCLE,
  ORDER_STATUS_LABELS,
  canAdvanceTo,
  handoffStageOptions,
  nextLifecycleStatus,
} from '../src/lib/order-workflow.ts'

test('fulfillment lifecycle matches the client-facing stage names', () => {
  assert.deepEqual([...ORDER_LIFECYCLE], [
    'created',
    'procurement',
    'mockup',
    'client_approval',
    'production',
    'packaging_qc',
    'dispatched',
    'delivered',
  ])
  assert.deepEqual(
    ORDER_LIFECYCLE.map((status) => CLIENT_STATUS_LABELS[status]),
    [
      'Order received',
      'Procurement',
      'Mockup',
      'Client approval',
      'Production',
      'Packaging / QC',
      'Dispatch',
      'Delivered',
    ]
  )
  for (const status of ORDER_LIFECYCLE) {
    assert.equal(ORDER_STATUS_LABELS[status], CLIENT_STATUS_LABELS[status])
  }
})

test('legacy statuses fold without skipping procurement or the approval gate', () => {
  assert.deepEqual(LEGACY_ORDER_STATUS_MAP, {
    created: 'created',
    confirmed: 'created',
    in_progress: 'procurement',
    procurement: 'procurement',
    printing: 'production',
    quality_check: 'packaging_qc',
    ready_to_dispatch: 'packaging_qc',
    dispatched: 'dispatched',
    delivered: 'delivered',
    cancelled: 'cancelled',
  })
  assert.equal(LEGACY_ORDER_STATUS_MAP.printing, 'production')
  assert.notEqual(LEGACY_ORDER_STATUS_MAP.in_progress, 'production')
  assert.equal(nextLifecycleStatus('mockup'), 'client_approval')
  assert.equal(nextLifecycleStatus('client_approval'), 'production')
})

test('client approval blocks production and request-changes returns to mockup', () => {
  assert.equal(canAdvanceTo('created', 'production').ok, false)
  assert.equal(canAdvanceTo('created', 'procurement').ok, true)
  assert.equal(canAdvanceTo('mockup', 'client_approval').ok, true)
  assert.deepEqual(canAdvanceTo('client_approval', 'production', null), {
    ok: false,
    reason: 'Client approval is required before production',
  })
  assert.equal(canAdvanceTo('client_approval', 'production', 'changes_requested').ok, false)
  assert.equal(canAdvanceTo('client_approval', 'production', 'approved').ok, true)
  assert.equal(canAdvanceTo('client_approval', 'mockup').ok, true)
  assert.equal(canAdvanceTo('production', 'packaging_qc', 'approved').ok, true)
  assert.equal(canAdvanceTo('dispatched', 'delivered').ok, true)
  assert.equal(canAdvanceTo('delivered', 'cancelled').ok, false)
  assert.equal(canAdvanceTo('procurement', 'cancelled').ok, true)
  assert.equal(canAdvanceTo('client_approval', 'client_approval', null).ok, true)

  const waiting = handoffStageOptions('client_approval', null).map((option) => option.value)
  assert.deepEqual(waiting, ['client_approval', 'mockup', 'cancelled'])
  const approved = handoffStageOptions('client_approval', 'approved').map((option) => option.value)
  assert.ok(approved.includes('production'))
  assert.ok(approved.includes('mockup'))
})
