import assert from 'node:assert/strict'
import test from 'node:test'
import { confirmLandingForRole, portalSetPasswordUrl } from '../src/lib/auth/confirm-landing.ts'
import { BUSINESS_PRICE_SIGN_IN, businessPriceNotice, shouldShowBusinessPrompt } from '../src/lib/business/price-access.ts'
import { FREE_EMAIL_DOMAINS, workEmailBlock } from '../src/lib/business/email-domain.ts'
import { canSendPortalInvite, confirmNextAllowed } from '../src/lib/portal/separation.ts'

test('business and microsite confirm links stay on their own product', () => {
  assert.equal(confirmNextAllowed('client_admin', '/portal/gifts'), true)
  assert.equal(confirmNextAllowed('client_user', '/business/dashboard'), false)
  assert.equal(confirmNextAllowed('business_user', '/business/catalogue'), true)
  assert.equal(confirmNextAllowed('business_user', '/portal/gifts'), false)
  assert.equal(confirmLandingForRole('client_admin', 'magiclink', '/business/dashboard'), '/portal/gifts')
  assert.equal(confirmLandingForRole('business_user', 'magiclink', '/portal/gifts'), '/business/dashboard')
  assert.equal(confirmLandingForRole('business_user', 'magiclink', '/business/dashboard'), '/business/dashboard')
  assert.equal(confirmLandingForRole('client_user', 'recovery', '/portal/gifts'), null)

  const href = portalSetPasswordUrl('https://tcs.giftingstore.online', {
    hashedToken: 'abc',
    verificationType: 'recovery',
    actionLink: 'https://project.supabase.co/auth/v1/verify?token=abc',
  })
  const url = new URL(href)
  assert.equal(url.origin, 'https://tcs.giftingstore.online')
  assert.equal(url.pathname, '/auth/confirm')
  assert.equal(url.searchParams.get('type'), 'recovery')
  assert.equal(url.searchParams.get('next'), null)
})

test('signed-out visitors do not see a business price', () => {
  assert.equal(businessPriceNotice('anonymous'), BUSINESS_PRICE_SIGN_IN)
  assert.match(businessPriceNotice('pending') || '', /approved/i)
  assert.equal(businessPriceNotice('open'), null)
})

test('the retail prompt waits for a choice and does not repeat in the session', () => {
  assert.equal(shouldShowBusinessPrompt({ choiceCookie: null, seenThisSession: false }), true)
  assert.equal(shouldShowBusinessPrompt({ choiceCookie: '', seenThisSession: false }), true)
  assert.equal(shouldShowBusinessPrompt({ choiceCookie: 'retail', seenThisSession: false }), false)
  assert.equal(shouldShowBusinessPrompt({ choiceCookie: 'corporate', seenThisSession: false }), false)
  assert.equal(shouldShowBusinessPrompt({ choiceCookie: null, seenThisSession: true }), false)
})

test('sales can send a portal invitation and free inboxes stay blocked', () => {
  assert.equal(canSendPortalInvite('sales'), true)
  assert.equal(canSendPortalInvite('admin'), true)
  assert.equal(canSendPortalInvite('operations'), false)
  assert.equal(canSendPortalInvite('client_admin'), false)
  for (const domain of ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com']) {
    assert.equal(FREE_EMAIL_DOMAINS.includes(domain as (typeof FREE_EMAIL_DOMAINS)[number]), true)
    assert.match(workEmailBlock(`buyer@${domain}`, []) || '', /work email/i)
  }
  assert.match(workEmailBlock('buyer@yahoo.in', []) || '', /work email/i)
  assert.equal(workEmailBlock('buyer@tcs.com', []), null)
})
