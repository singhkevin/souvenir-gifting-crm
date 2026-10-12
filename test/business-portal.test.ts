import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCartAddQuery, planStoreCartAdd } from '../src/lib/catalogue/cart-add.ts'
import { quoteCheckoutExpiry } from '../src/lib/business/checkout-window.ts'
import { classifyBusinessEmail, shouldAttachNamedCompany } from '../src/lib/business/email-domain.ts'
import { gstinCheckDigit, gstinError, isValidGstin } from '../src/lib/business/gstin.ts'
import { businessQuantityError, normaliseBreaks } from '../src/lib/business/lines.ts'
import { isBusinessRole, isClientRole, isStaffRole } from '../src/lib/roles.ts'

test('gstin accepts a known number and rejects a changed check digit', () => {
  assert.equal(gstinError('27aaacr5055k1z7'), null)
  assert.equal(isValidGstin('27AAACR5055K1Z7'), true)
  assert.equal(gstinCheckDigit('27AAACR5055K1Z'), '7')
  assert.match(gstinError('27AAACR5055K1Z8') || '', /check digit/)
  assert.equal(gstinError(''), 'GSTIN is required for an Indian business')
  assert.match(gstinError('99AAACR5055K1Z7') || '', /state code/)
})

test('business email flags and company attach rules', () => {
  const flags = classifyBusinessEmail('buyer@gmail.com', [{ name: 'Acme', domains: ['acme.com'] }])
  assert.equal(flags.freeMail, true)
  assert.equal(flags.possibleClientName, null)
  const match = classifyBusinessEmail('a@acme.com', [{ name: 'Acme', domains: ['acme.com'] }])
  assert.equal(match.possibleClientName, 'Acme')
  assert.equal(classifyBusinessEmail('a@mailinator.com', []).disposable, true)
  assert.equal(shouldAttachNamedCompany({ status: 'active', account_type: 'corporate' }), false)
  assert.equal(shouldAttachNamedCompany({ status: 'active' }), false)
  assert.equal(shouldAttachNamedCompany({ status: 'prospect', account_type: 'corporate' }), true)
  assert.equal(shouldAttachNamedCompany({ status: 'active', account_type: 'business' }), true)
  assert.equal(shouldAttachNamedCompany(null), false)
})

test('quote basket quantities and breaks', () => {
  assert.equal(businessQuantityError(10, 25), 'Quantity must be a whole number from 25 to 1,00,000')
  assert.equal(businessQuantityError(25, 25), null)
  assert.equal(businessQuantityError(100001, 1), 'Quantity must be a whole number from 1 to 1,00,000')
  assert.deepEqual(normaliseBreaks(10, 20, [20, 15, 15, 5, 30, 40, 50]), [15, 30, 40])
})

test('store cart add parser skips bad rows and caps buyable quantity', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  const other = '22222222-2222-4222-8222-222222222222'
  const parsed = parseCartAddQuery(`${id}:4,nope:2,${other}:0`)
  assert.deepEqual(parsed, [{ id, quantity: 4 }])
  const plan = planStoreCartAdd(
    [{ id, quantity: 9 }, { id: other, quantity: 2 }],
    [
      { id, purchase: { buy: true, rfq: true, maxBuyQty: 3, stockQty: 3, mode: 'auto', reason: 'stock' } },
      { id: other, purchase: { buy: false, rfq: true, maxBuyQty: null, stockQty: 0, mode: 'rfq', reason: 'flag-rfq' } },
    ],
  )
  assert.deepEqual(plan.added, [{ id, quantity: 3 }])
  assert.equal(plan.skipped.length, 1)
})

test('quote checkout expires at the earlier of valid-until and seven days', () => {
  const now = Date.parse('2026-10-12T00:00:00Z')
  assert.equal(quoteCheckoutExpiry('2026-10-13', now), new Date('2026-10-13T23:59:59+05:30').toISOString())
  assert.equal(quoteCheckoutExpiry('2026-12-01', now), new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString())
  assert.equal(quoteCheckoutExpiry(null, now), new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString())
})

test('business_user is its own role and not staff or client', () => {
  assert.equal(isBusinessRole('business_user'), true)
  assert.equal(isStaffRole('business_user'), false)
  assert.equal(isClientRole('business_user'), false)
  assert.equal(isBusinessRole('business'), false)
})
