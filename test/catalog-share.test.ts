import assert from 'node:assert/strict'
import test from 'node:test'
import { originFromForwarded } from '../src/lib/auth/public-origin.ts'
import {
  extendShareExpiry,
  isShareToken,
  shareExpiryIso,
  shareLinkGrantsAccess,
  sharePath,
} from '../src/lib/catalogs/share-link.ts'
import {
  defaultResendFrom,
  RESEND_NOT_CONFIGURED_ERROR,
  resendConfigFrom,
  resendHttpError,
} from '../src/lib/email/resend-config.ts'

const NOW = new Date('2026-10-05T00:00:00.000Z')

test('guest share access rejects revoked and expired tokens and accepts open ones', () => {
  assert.equal(shareLinkGrantsAccess(null, NOW.getTime()), false)
  assert.equal(shareLinkGrantsAccess({ revoked_at: NOW.toISOString(), expires_at: null }, NOW.getTime()), false)
  assert.equal(shareLinkGrantsAccess({ revoked_at: null, expires_at: '2026-10-04T00:00:00.000Z' }, NOW.getTime()), false)
  assert.equal(shareLinkGrantsAccess({ revoked_at: null, expires_at: NOW.toISOString() }, NOW.getTime()), false)
  assert.equal(shareLinkGrantsAccess({ revoked_at: null, expires_at: null }, NOW.getTime()), true)
  assert.equal(shareLinkGrantsAccess({ revoked_at: null, expires_at: '2026-11-04T00:00:00.000Z' }, NOW.getTime()), true)
  assert.equal(shareLinkGrantsAccess({ expires_at: 'not-a-date' }, NOW.getTime()), false)
})

test('share expiry is 30 days and extend moves a future date forward', () => {
  assert.equal(shareExpiryIso(NOW), '2026-11-04T00:00:00.000Z')
  assert.equal(extendShareExpiry('2026-10-20T00:00:00.000Z', NOW), '2026-11-19T00:00:00.000Z')
  assert.equal(extendShareExpiry('2026-10-01T00:00:00.000Z', NOW), '2026-11-04T00:00:00.000Z')
  assert.equal(extendShareExpiry(null, NOW), '2026-11-04T00:00:00.000Z')
})

test('share tokens and paths stay url-safe', () => {
  const token = 'abcdefghijklmnopqrstuvwx012345'
  assert.equal(isShareToken(token), true)
  assert.equal(isShareToken('short'), false)
  assert.equal(isShareToken(`${token}+`), false)
  assert.equal(sharePath(token), `/share/catalogs/${token}`)
})

test('public origin uses the first forwarded host and protocol', () => {
  assert.equal(
    originFromForwarded('www.giftingstore.online, internal.local', 'https,http'),
    'https://www.giftingstore.online',
  )
  assert.equal(originFromForwarded('localhost:3000', null), 'http://localhost:3000')
  assert.equal(originFromForwarded(null, null), 'http://localhost:3000')
})

test('catalog email uses the same Resend key and from address as the rest of the app', () => {
  const missing = resendConfigFrom({})
  assert.deepEqual(missing, { error: RESEND_NOT_CONFIGURED_ERROR })
  assert.match(RESEND_NOT_CONFIGURED_ERROR, /RESEND_API_KEY/)
  assert.match(RESEND_NOT_CONFIGURED_ERROR, /RESEND_FROM_EMAIL/)

  const keyOnly = resendConfigFrom({ RESEND_API_KEY: ' re_test_key ' })
  assert.deepEqual(keyOnly, { apiKey: 're_test_key', from: defaultResendFrom() })

  const customFrom = resendConfigFrom({
    RESEND_API_KEY: 're_test_key',
    RESEND_FROM_EMAIL: 'Souvenir - Gifting Solutions <catalogs@giftingstore.online>',
  })
  assert.deepEqual(customFrom, {
    apiKey: 're_test_key',
    from: 'Souvenir - Gifting Solutions <catalogs@giftingstore.online>',
  })

  assert.match(resendHttpError(401), /RESEND_API_KEY/)
  assert.match(resendHttpError(422), /RESEND_FROM_EMAIL/)
  assert.equal(resendHttpError(500), 'Unable to send email right now.')
})
