import assert from 'node:assert/strict'
import test from 'node:test'
import { presentBusinessProduct, resolveBusinessAccess } from '../src/lib/business/access-state.ts'
import { BUSINESS_PRICE_AWAITING, BUSINESS_PRICE_SIGN_IN, BUSINESS_WRONG_ACCOUNT } from '../src/lib/business/price-access.ts'

const company = {
  id: 'c1',
  name: 'Acme',
  account_type: 'business',
  business_verification: 'unverified',
  status: 'prospect',
}

function profile(role: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    full_name: 'Ada',
    email: 'ada@acme.com',
    role,
    department_id: null,
    company_id: 'c1',
    is_active: true,
    ...extra,
  }
}

test('business access hides prices until the account is verified', () => {
  const signedOut = resolveBusinessAccess({ profile: null, company: null })
  assert.equal(signedOut.state, 'signed_out')
  assert.equal(signedOut.canSeePrices, false)
  assert.equal(signedOut.canSubmitQuote, false)
  assert.equal(signedOut.priceNotice, BUSINESS_PRICE_SIGN_IN)

  const pending = resolveBusinessAccess({ profile: profile('business_user'), company })
  assert.equal(pending.state, 'pending')
  assert.equal(pending.priceNotice, BUSINESS_PRICE_AWAITING)
  assert.equal(pending.canSeePrices, false)
  assert.equal(pending.canSubmitQuote, false)

  const verified = resolveBusinessAccess({
    profile: profile('business_user'),
    company: { ...company, business_verification: 'verified', status: 'active' },
  })
  assert.equal(verified.state, 'verified')
  assert.equal(verified.canSeePrices, true)
  assert.equal(verified.canSubmitQuote, true)
  assert.equal(verified.priceNotice, null)
})

test('a shop account is not a business account and a direct company is not the business portal', () => {
  const retail = resolveBusinessAccess({
    profile: profile('retail', { company_id: null }),
    company: null,
  })
  assert.equal(retail.state, 'wrong_account')
  assert.equal(retail.reason, 'retail')
  assert.equal(retail.banner, BUSINESS_WRONG_ACCOUNT)
  assert.equal(retail.canSeePrices, false)

  const direct = resolveBusinessAccess({
    profile: profile('business_user'),
    company: { ...company, account_type: 'direct' },
  })
  assert.equal(direct.state, 'wrong_account')
  assert.equal(direct.canSeePrices, false)

  const rejected = resolveBusinessAccess({
    profile: profile('business_user'),
    company: { ...company, business_verification: 'rejected' },
  })
  assert.equal(rejected.state, 'rejected')
  assert.equal(rejected.canSubmitQuote, false)
})

test('existing free-email accounts stay usable and a block policy can lock them', () => {
  const verified = { ...company, business_verification: 'verified', status: 'active' }
  const flagged = resolveBusinessAccess({
    profile: profile('business_user', { email: 'owner@gmail.com' }),
    company: verified,
    emailPolicy: 'flag',
  })
  assert.equal(flagged.state, 'verified')
  assert.equal(flagged.emailReview, 'free')
  assert.equal(flagged.canSeePrices, true)

  const blocked = resolveBusinessAccess({
    profile: profile('business_user', { email: 'owner@gmail.com' }),
    company: verified,
    emailPolicy: 'block',
  })
  assert.equal(blocked.state, 'email_not_allowed')
  assert.equal(blocked.canSeePrices, false)
  assert.equal(blocked.canSubmitQuote, false)
})

test('catalogue payloads drop retail and business prices unless access is open', () => {
  const product = {
    id: 'p1',
    name: 'Pen',
    sku: 'PEN',
    description: null,
    image_url: null,
    price: 499,
    moq: 25,
    category_id: null,
    category_name: null,
    brand_id: null,
    brand_name: null,
    brand_logo_url: null,
    occasion_tags: [],
    status: 'active',
    created_at: null,
    purchase: { buy: true, rfq: false, maxBuyQty: null, stockQty: 1, mode: 'buy' as const, reason: 'flag-buy' as const },
    priceNote: 'incl. GST',
  }
  const hidden = presentBusinessProduct(product, 640, 'excl. GST', false)
  assert.equal(hidden.price, null)
  assert.equal(hidden.indicativePrice, null)
  assert.equal(hidden.priceNote, null)
  assert.equal(JSON.stringify(hidden).includes('499'), false)
  assert.equal(JSON.stringify(hidden).includes('640'), false)
  assert.equal(hidden.moqUnits, 25)

  const shown = presentBusinessProduct(product, 640, 'excl. GST', true)
  assert.equal(shown.price, 640)
  assert.equal(shown.indicativePrice, 640)
  assert.equal(JSON.stringify(shown).includes('499'), false)
})
