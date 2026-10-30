import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mapRegistrationFailure,
  REGISTER_CAPTCHA,
  REGISTER_EMAIL_TAKEN,
  REGISTER_GSTIN,
  REGISTER_PORTAL_EMAIL,
  REGISTER_SERVER,
  REGISTER_WORK_EMAIL,
} from '../src/lib/business/register-errors.ts'
import { resolvePublicContactPhone, whatsAppHref } from '../src/lib/contact/public-phone.ts'

test('registration failures map to a specific message', () => {
  assert.equal(mapRegistrationFailure('User already registered'), REGISTER_EMAIL_TAKEN)
  assert.equal(mapRegistrationFailure('email already registered'), REGISTER_EMAIL_TAKEN)
  assert.equal(mapRegistrationFailure('Captcha failed. Please try again.'), REGISTER_CAPTCHA)
  assert.equal(mapRegistrationFailure('invalid GSTIN'), REGISTER_GSTIN)
  assert.equal(mapRegistrationFailure('work email required'), REGISTER_WORK_EMAIL)
  assert.equal(mapRegistrationFailure('company portal email'), REGISTER_PORTAL_EMAIL)
  assert.equal(mapRegistrationFailure('duplicate key value'), REGISTER_SERVER)
  assert.equal(mapRegistrationFailure(''), REGISTER_SERVER)
})

test('public phone prefers the environment value', () => {
  assert.equal(resolvePublicContactPhone('  +91 22 0000 0000 ', '99999'), '+91 22 0000 0000')
  assert.equal(resolvePublicContactPhone('', ' 080 0000 0000 '), '080 0000 0000')
  assert.equal(resolvePublicContactPhone('  ', null), null)
  assert.equal(whatsAppHref('+91 22 0000 0000'), 'https://wa.me/912200000000')
  assert.equal(whatsAppHref('123'), null)
})
