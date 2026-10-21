import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { storeCartCheckoutInput, storeGuestContact } from '../src/lib/catalogue/store-guest.ts'

const form = {
  full_name: ' Ada Lovelace ',
  email: 'Ada@Example.com',
  company_name: '',
  phone: '  ',
  fax: '',
}

test('store checkout maps snake_case cart fields onto camelCase', () => {
  const lines = [{ productId: 'p1', quantity: 1, catalogId: null }]
  assert.deepEqual(storeCartCheckoutInput(form, lines, 'key-1'), {
    fullName: ' Ada Lovelace ',
    email: 'Ada@Example.com',
    companyName: '',
    phone: '  ',
    fax: '',
    lines,
    idempotencyKey: 'key-1',
  })
})

test('a filled name passes and an empty company falls back to that name', () => {
  const mapped = storeCartCheckoutInput(form, [], 'key-1')
  assert.deepEqual(storeGuestContact(mapped), {
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    companyName: 'Ada Lovelace',
    phone: '',
  })
})

test('a company name is kept when the guest provides one', () => {
  const contact = storeGuestContact({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    companyName: ' Analytical Engines ',
  })
  assert.equal('error' in contact ? contact.error : contact.companyName, 'Analytical Engines')
})

test('guest checkout still rejects a blank name and a bad email', () => {
  assert.deepEqual(
    storeGuestContact({ fullName: '  ', email: 'ada@example.com', companyName: 'Engines' }),
    { error: 'Please share your name.' },
  )
  assert.deepEqual(
    storeGuestContact({ fullName: 'Ada Lovelace', email: 'not-an-email', companyName: '' }),
    { error: 'Please share a valid email.' },
  )
})

test('the cart form sends the mapped checkout payload', () => {
  const source = readFileSync(new URL('../src/components/site/cart-checkout.tsx', import.meta.url), 'utf8')
  assert.match(source, /checkoutStoreCart\(storeCartCheckoutInput\(form, lines, key\)\)/)
  assert.doesNotMatch(source, /checkoutStoreCart\(\{\s*\.\.\.form/)
  assert.match(source, /placeholder="Company \(optional\)"/)
})

test('snake_case keys alone do not satisfy the guest name check', () => {
  const spread = {
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    company_name: 'Engines',
    phone: '',
    fax: '',
  }
  assert.deepEqual(storeGuestContact(spread), { error: 'Please share your name.' })
})
