import assert from 'node:assert/strict'
import test from 'node:test'
import { pickAlertOwnerId } from '../src/lib/alerts/owner-id.ts'
import {
  clientQuotePath,
  defaultQuoteRecipientKey,
  draftGstPercent,
  estimateTickedLines,
  liveMarginPercent,
  marginWarnings,
  quoteLineTotal,
  quoteSendRecipients,
  sendQuoteWarnings,
  suggestedSell,
} from '../src/lib/quotes/flow.ts'

test('line totals are pre-tax after discount and GST is added once', () => {
  assert.equal(quoteLineTotal(2, 100, 10), 180)
  assert.equal(quoteLineTotal(1, 50, 0), 50)
  assert.equal(quoteLineTotal(3, 10.5, 0), 31.5)

  const estimate = estimateTickedLines(
    [
      { quantity: 2, unitPrice: 100, lineTotal: 180 },
      { quantity: 1, unitPrice: 50, lineTotal: 45, ticked: false },
    ],
    18,
  )
  assert.equal(estimate.subtotal, 200)
  assert.equal(estimate.discount, 20)
  assert.equal(estimate.net, 180)
  assert.equal(estimate.tax, 32.4)
  assert.equal(estimate.total, 212.4)
  assert.equal(estimate.total, estimate.subtotal - estimate.discount + estimate.tax)
  assert.equal(estimate.total, estimate.net + estimate.tax)
})

test('margin warnings and default margin need a cost', () => {
  assert.deepEqual(marginWarnings(null, 100), ['missing_cost'])
  assert.deepEqual(marginWarnings(Number.NaN, 100), ['missing_cost'])
  assert.deepEqual(marginWarnings(9, 100), ['below_ten_percent'])
  assert.deepEqual(marginWarnings(10, 100), [])
  assert.deepEqual(marginWarnings(150, 100), ['above_sell'])
  assert.equal(suggestedSell(null, 35), null)
  assert.equal(suggestedSell(100, 35), 135)
  assert.equal(liveMarginPercent(null, 135), null)
  assert.equal(liveMarginPercent(100, 135), 35)
  assert.equal(draftGstPercent(null), 18)
  assert.equal(draftGstPercent(12), 12)
  assert.equal(draftGstPercent(0, ''), 18)
})

test('send dialog defaults to the quote contact, then the first recipient', () => {
  const recipients = quoteSendRecipients({
    contacts: [
      { id: 'c1', full_name: 'Ada', email: 'ada@client.test' },
      { id: 'c2', full_name: 'Bo', email: 'bo@client.test' },
      { id: 'c3', full_name: 'No mail', email: null },
    ],
    users: [
      { id: 'u1', full_name: 'Cara', email: 'cara@client.test', role: 'client_user' },
      { id: 'u2', full_name: 'Ada User', email: 'ada@client.test', role: 'client_admin' },
      { id: 'u3', full_name: 'Dev', email: 'dev@biz.test', role: 'business_user' },
    ],
  })
  assert.deepEqual(recipients.map((row) => row.key), ['contact:c1', 'contact:c2', 'user:u1', 'user:u3'])
  assert.equal(defaultQuoteRecipientKey({ contactId: 'c2', recipients }), 'contact:c2')
  assert.equal(defaultQuoteRecipientKey({ contactId: null, recipients }), 'contact:c1')
  assert.equal(defaultQuoteRecipientKey({ contactId: 'missing', recipients }), 'contact:c1')
  assert.equal(defaultQuoteRecipientKey({ contactId: null, recipients: [] }), null)
  assert.deepEqual(
    sendQuoteWarnings([
      { name: 'Pen', unitPrice: 0, cost: 40, applied: false },
      { name: 'Mug', unitPrice: 20, cost: 30, applied: true },
    ]),
    [
      'Pen: costing is not applied',
      'Pen: sell price is 0',
      'Pen: sell price is below cost',
      'Mug: sell price is below cost',
    ],
  )
  assert.equal(clientQuotePath('business', 'q1'), '/business/quotes/q1')
  assert.equal(clientQuotePath('corporate', 'q1'), '/portal/quotations/q1')
})

test('inactive owners route alerts to the default owner', () => {
  assert.equal(pickAlertOwnerId({ ownerId: 'owner', ownerActive: true, fallbackOwnerId: 'fallback' }), 'owner')
  assert.equal(pickAlertOwnerId({ ownerId: 'owner', ownerActive: false, fallbackOwnerId: 'fallback' }), 'fallback')
  assert.equal(pickAlertOwnerId({ ownerId: null, ownerActive: null, fallbackOwnerId: 'fallback' }), 'fallback')
  assert.equal(pickAlertOwnerId({ ownerId: 'owner', ownerActive: false, fallbackOwnerId: null }), null)
})
