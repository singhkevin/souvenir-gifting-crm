import assert from 'node:assert/strict'
import test from 'node:test'
import { workEmailBlock } from '../src/lib/business/email-domain.ts'
import { readFileSync } from 'node:fs'
import { gstinError } from '../src/lib/business/gstin.ts'
import { businessConfirmUrl, confirmLandingPath } from '../src/lib/auth/confirm-landing.ts'
import { companyHint, companyListLabel, dedupeById } from '../src/lib/catalogs/company-option.ts'

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
