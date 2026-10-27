import assert from 'node:assert/strict'
import test from 'node:test'
import { quoteExpiryRecipientEmails } from '../src/lib/quotes/expiry-recipients.ts'

test('a contact email is the only expiry recipient', () => {
  assert.deepEqual(quoteExpiryRecipientEmails({
    contactEmail: 'buyer@acme.com',
    accountEmails: ['portal@acme.com'],
  }), ['buyer@acme.com'])
})

test('portal and business account emails are used when the quote has no contact email', () => {
  assert.deepEqual(quoteExpiryRecipientEmails({
    contactEmail: null,
    accountEmails: ['  Buyer@acme.com ', 'buyer@acme.com', '', 'not-an-email', 'ops@acme.com'],
  }), ['Buyer@acme.com', 'ops@acme.com'])
})

test('no recipient when neither a contact nor an account email is usable', () => {
  assert.deepEqual(quoteExpiryRecipientEmails({ contactEmail: ' ', accountEmails: [null, ''] }), [])
})
