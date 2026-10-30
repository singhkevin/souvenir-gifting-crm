import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { DISPOSABLE_EMAIL_DOMAINS, FREE_EMAIL_DOMAINS, emailDomainRuleChoice, emailReviewFlag, micrositeDomainConflict, workEmailBlock } from '../src/lib/business/email-domain.ts'
import { gstinError } from '../src/lib/business/gstin.ts'
import { businessConfirmUrl, confirmLandingPath } from '../src/lib/auth/confirm-landing.ts'
import { companyHint, companyListLabel, dedupeById } from '../src/lib/catalogs/company-option.ts'

test('email domain rules in the database match the app lists and grandfather existing accounts', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20261030b_business_email_domains.sql', import.meta.url),
    'utf8',
  )
  for (const domain of FREE_EMAIL_DOMAINS) {
    assert.match(sql, new RegExp(`'${domain.replace('.', '\\.')}', 'block_free'`))
  }
  for (const domain of DISPOSABLE_EMAIL_DOMAINS) {
    assert.match(sql, new RegExp(`'${domain.replace('.', '\\.')}', 'block_disposable'`))
  }
  assert.match(sql, /profiles_enforce_business_email_domain/)
  assert.match(sql, /Grandfather/)
  assert.match(sql, /business_free_email_review/)
  assert.match(sql, /public\.is_work_email\(v_email\)/)
  assert.doesNotMatch(sql, /is_active = false/)
})

test('work email rules prefer the database list and still fall back offline', () => {
  const rules = [
    { domain: 'gmail.com', rule: 'block_free' as const },
    { domain: 'acme.com', rule: 'allow' as const },
  ]
  assert.match(workEmailBlock('buyer@gmail.com', ['gmail.com'], rules) || '', /work email/i)
  assert.equal(workEmailBlock('buyer@gmail.com', [], [{ domain: 'gmail.com', rule: 'allow' }]), null)
  assert.equal(workEmailBlock('buyer@acme.com', [], rules), null)
  assert.equal(emailReviewFlag('owner@gmail.com', rules), 'free')
  assert.equal(emailReviewFlag('owner@gmail.com', [{ domain: 'gmail.com', rule: 'allow' }]), null)
  assert.equal(emailReviewFlag('owner@mailinator.com'), 'disposable')
})

test('the database rejects a microsite domain on a new business account and leaves direct customers alone', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20261030c_business_portal_domain.sql', import.meta.url),
    'utf8',
  )
  assert.match(sql, /company portal email/)
  assert.match(sql, /c\.account_type = 'corporate'/)
  assert.match(sql, /Grandfather/)
  assert.doesNotMatch(sql, /account_type = 'direct'/)
  const rollback = readFileSync(
    new URL('../supabase/rollbacks/20261030c_business_portal_domain_rollback.sql', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(rollback, /company portal email/)
})

test('a microsite client domain cannot register as a business, and a direct customer domain can', () => {
  const companies = [
    { name: 'Tata Consultancy', domains: ['tcs.com'], account_type: 'corporate', status: 'active' },
    { name: 'A person', domains: ['person.example'], account_type: 'direct', status: 'active' },
    { name: 'Old client', domains: ['old.example'], account_type: 'corporate', status: 'inactive' },
  ]
  assert.equal(micrositeDomainConflict('employee@tcs.com', companies)?.name, 'Tata Consultancy')
  assert.equal(micrositeDomainConflict('person@person.example', companies), null)
  assert.equal(micrositeDomainConflict('old@old.example', companies), null)
  assert.equal(micrositeDomainConflict('buyer@gmail.com', companies), null)
})

test('email domain settings only accept allow, block free, and block disposable', () => {
  assert.equal(emailDomainRuleChoice('allow'), 'allow')
  assert.equal(emailDomainRuleChoice('block_free'), 'block_free')
  assert.equal(emailDomainRuleChoice('block_disposable'), 'block_disposable')
  assert.equal(emailDomainRuleChoice('block'), null)
})

test('business sign-up blocks free email unless the domain is allowlisted', () => {
  assert.match(workEmailBlock('buyer@gmail.com', []) || '', /work email/i)
  assert.match(workEmailBlock('buyer@yahoo.com', []) || '', /work email/i)
  assert.match(workEmailBlock('buyer@hotmail.com', []) || '', /work email/i)
  assert.match(workEmailBlock('buyer@outlook.com', []) || '', /work email/i)
  assert.match(workEmailBlock('buyer@live.com', []) || '', /work email/i)
  assert.match(workEmailBlock('buyer@icloud.com', []) || '', /work email/i)
  assert.equal(workEmailBlock('buyer@gmail.com', ['gmail.com']), null)
  assert.equal(workEmailBlock('buyer@acme.com', []), null)
  assert.match(workEmailBlock('buyer@mailinator.com', []) || '', /work email/i)
})

test('business sign-up checks GSTIN format only when one is provided', () => {
  assert.equal(gstinError(''), null)
  assert.equal(gstinError('   '), null)
  assert.equal(gstinError('27AAACR5055K1Z7'), null)
  assert.match(gstinError('27AAACR5055K1Z8') || '', /check digit/)
  assert.match(gstinError('NOT-A-GSTIN') || '', /15-character/)

  const next = readFileSync(new URL('../supabase/migrations/20261019_optional_registration_gstin.sql', import.meta.url), 'utf8')
  assert.match(next, /if v_gst is not null then/)
  assert.doesNotMatch(next, /if v_gst is null or/)
  assert.match(next, /work email required/)
  assert.match(next, /email_domain_allowlist/)
  const applied = readFileSync(new URL('../supabase/migrations/20261018_registration_pricing_samples.sql', import.meta.url), 'utf8')
  assert.match(applied, /if v_gst is null or v_gst !~/)
})

test('confirmation link stays on the store host and logs into the business dashboard', () => {
  const href = businessConfirmUrl('https://www.souvenirgifting.com', {
    hashedToken: 'abc',
    verificationType: 'magiclink',
    actionLink: 'https://project.supabase.co/auth/v1/verify?token=abc',
  })
  const url = new URL(href)
  assert.equal(url.origin, 'https://www.souvenirgifting.com')
  assert.equal(url.pathname, '/auth/confirm')
  assert.equal(url.searchParams.get('type'), 'magiclink')
  assert.equal(url.searchParams.get('next'), '/business/dashboard')
  assert.equal(confirmLandingPath('magiclink', '/business/dashboard'), '/business/dashboard')
  assert.equal(confirmLandingPath('recovery', '/business/dashboard'), null)
})

test('company picker dedupes ids and shows a secondary label', () => {
  const rows = dedupeById([
    { id: 'a', name: 'Ashutosh Choudhary', hint: companyHint({ allowed_email_domains: ['acme.com'] }) },
    { id: 'a', name: 'Ashutosh Choudhary', hint: 'duplicate' },
    { id: 'b', name: 'Ashutosh Choudhary', hint: companyHint({ portal_slug: 'ash' }) },
  ])
  assert.equal(rows.length, 2)
  assert.equal(companyListLabel(rows[0]), 'Ashutosh Choudhary · acme.com')
  assert.equal(companyListLabel(rows[1]), 'Ashutosh Choudhary · ash')
})
